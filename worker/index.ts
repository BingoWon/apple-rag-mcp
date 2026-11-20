import { originValidationResponse } from "@modelcontextprotocol/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { MCP_CLIENT_HEADER } from "../shared/mcp-clients.js";
import { siteSitemap } from "../shared/site.js";
import { apiApp } from "./api/app.js";
import { CLIAuthorization } from "./cli/authorization.js";
import { authorizationMetadata, cliOAuthRoutes } from "./cli/routes.js";
import { handleScheduled } from "./collector/handler.js";
import { handleAccountRequest } from "./mcp/account.js";
import { HEALTH_STATUS, SERVER_MANIFEST } from "./mcp/manifest.js";
import { MCPProtocolHandler } from "./mcp/protocol-handler.js";
import { AuthMiddleware } from "./mcp-auth/auth-middleware.js";
import type { WaitUntilContext } from "./services/d1-utils.js";
import { createServices } from "./services/index.js";
import type { Env } from "./shared/types.js";
import { sitePage } from "./site-pages.js";

const MCP_HOSTNAME = "mcp.apple-rag.com";
const MCP_ALLOWED_ORIGIN_HOSTNAMES = ["apple-rag.com", "www.apple-rag.com", MCP_HOSTNAME];
const MCP_ALLOWED_ORIGINS = [
	"https://apple-rag.com",
	"https://www.apple-rag.com",
	`https://${MCP_HOSTNAME}`,
];
const MCP_ALLOWED_HEADERS = [
	MCP_CLIENT_HEADER,
	"Content-Type",
	"Authorization",
	"MCP-Protocol-Version",
	"Mcp-Method",
	"Mcp-Name",
];

type HonoAppEnv = { Bindings: Env };

async function handleMCPRequest(c: {
	env: Env;
	executionCtx: WaitUntilContext;
	req: { raw: Request };
}) {
	const originRejection = originValidationResponse(c.req.raw, MCP_ALLOWED_ORIGIN_HOSTNAMES);
	if (originRejection) {
		return originRejection;
	}

	const handler = new MCPProtocolHandler(
		() => createServices(c.env, c.executionCtx, "mcp"),
		(request) => new AuthMiddleware(c.env.DB, c.executionCtx).optionalAuth(request),
	);
	const response = handler.handleRequest(c.req.raw);
	c.executionCtx.waitUntil(response);
	return response;
}

// ─── Main App (apple-rag.com) ────────────────────────────────
const app = new Hono<HonoAppEnv>();

app.onError((err, c) => {
	console.error("Unhandled error:", err instanceof Error ? err.message : String(err));
	return c.json({ error: { message: "Internal server error" } }, 500);
});

app.get("/health", (c) => c.json({ status: "ok" }));

// ─── SEO ──────────────────────────────────────────────────────
app.get("/robots.txt", (c) => {
	// UI routes must remain crawlable for search engines to observe their noindex headers.
	const body = [
		"User-agent: *",
		"Allow: /",
		"",
		"Disallow: /api/",
		"Disallow: /oauth/",
		"",
		"Sitemap: https://apple-rag.com/sitemap.xml",
	].join("\n");
	return c.text(body, 200, {
		"Content-Type": "text/plain",
		"Cache-Control": "public, max-age=86400",
	});
});

app.get("/sitemap.xml", (c) => {
	const xml = siteSitemap();
	return c.text(xml, 200, {
		"Content-Type": "application/xml",
		"Cache-Control": "public, max-age=86400",
	});
});

app.route("/api", apiApp);
app.route("/oauth/cli", cliOAuthRoutes);
app.get("/.well-known/oauth-authorization-server", (c) =>
	c.json(authorizationMetadata(new URL(c.req.url).origin)),
);

app.get("/mcp/health", (c) => c.json({ ...HEALTH_STATUS, timestamp: new Date().toISOString() }));

app.get("/mcp/account", (c) => handleAccountRequest(c.req.raw, c.env, c.executionCtx));

app.get("/mcp/manifest", (c) =>
	c.json(SERVER_MANIFEST, 200, { "Cache-Control": "public, max-age=3600" }),
);

app.use(
	"/mcp",
	cors({
		origin: MCP_ALLOWED_ORIGINS,
		allowMethods: ["POST", "OPTIONS"],
		allowHeaders: MCP_ALLOWED_HEADERS,
	}),
);

app.post("/mcp", (c) => handleMCPRequest(c));

app.on(["GET", "DELETE"], "/mcp", (c) =>
	c.text("Method Not Allowed", 405, {
		Allow: "POST, OPTIONS",
		"Access-Control-Allow-Origin": "*",
	}),
);

app.post("/api/collector/trigger", async (c) => {
	const adminPassword = c.req.header("X-Admin-Password");
	if (!adminPassword || adminPassword !== c.env.ADMIN_PASSWORD) {
		return c.json({ error: "Unauthorized" }, 401);
	}
	try {
		await handleScheduled(c.env);
		return c.json({ message: "Processing completed" });
	} catch {
		return c.json({ error: "Processing failed" }, 500);
	}
});

app.notFound(async (c) => {
	if (c.req.path.startsWith("/api/") || c.req.path === "/mcp" || c.req.path.startsWith("/mcp/")) {
		return c.json({ error: { message: "Not Found" } }, 404);
	}
	if (c.env.ASSETS) {
		try {
			const res = await c.env.ASSETS.fetch(c.req.raw);
			if (
				res.status === 404 &&
				["GET", "HEAD"].includes(c.req.method) &&
				!/\.[a-z0-9]{1,8}$/i.test(c.req.path) &&
				!c.req.path.startsWith("/assets/")
			) {
				const url = new URL(c.req.url);
				url.pathname = "/";
				url.search = "";
				const request = new Request(url.toString(), c.req.raw);
				request.headers.delete("If-None-Match");
				request.headers.delete("If-Modified-Since");
				const shell = await c.env.ASSETS.fetch(request);
				return shell.ok ? sitePage(shell, c.req.path) : shell;
			}
			if (res.ok && res.headers.get("Content-Type")?.includes("text/html"))
				return sitePage(res, c.req.path);
			return res;
		} catch {}
	}
	return c.text("Not Found", 404);
});

// ─── MCP-only App (mcp.apple-rag.com) ───────────────────────
const mcpApp = new Hono<HonoAppEnv>();

mcpApp.onError((err, c) => {
	console.error("MCP error:", err instanceof Error ? err.message : String(err));
	return c.json(
		{
			jsonrpc: "2.0",
			id: null,
			error: { code: -32603, message: "Internal server error" },
		},
		500,
	);
});

mcpApp.use(
	"*",
	cors({
		origin: MCP_ALLOWED_ORIGINS,
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: MCP_ALLOWED_HEADERS,
	}),
);

mcpApp.get("/health", (c) => c.json({ ...HEALTH_STATUS, timestamp: new Date().toISOString() }));

mcpApp.get("/account", (c) => handleAccountRequest(c.req.raw, c.env, c.executionCtx));

mcpApp.get("/manifest", (c) =>
	c.json(SERVER_MANIFEST, 200, { "Cache-Control": "public, max-age=3600" }),
);

mcpApp.post("/", (c) => handleMCPRequest(c));

mcpApp.on(["GET", "DELETE"], "/", (c) =>
	c.text("Method Not Allowed", 405, {
		Allow: "POST, OPTIONS",
		"Access-Control-Allow-Origin": "*",
	}),
);

mcpApp.all("*", (c) =>
	c.json({ error: "MCP endpoint", message: "POST / for protocol, GET /health or /manifest" }, 404),
);

// ─── Router ──────────────────────────────────────────────────
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		if (new URL(request.url).hostname === MCP_HOSTNAME) {
			return mcpApp.fetch(request, env, ctx);
		}
		return app.fetch(request, env, ctx);
	},

	async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		ctx.waitUntil(
			new CLIAuthorization(env.DB, env.JWT_SECRET, "https://apple-rag.com")
				.cleanup()
				.catch(() => console.error("CLI authorization cleanup failed.")),
		);
		await handleScheduled(env);
	},
};
