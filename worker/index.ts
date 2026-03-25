import { Hono } from "hono";
import { cors } from "hono/cors";
import { apiApp } from "./api/app.js";
import { handleScheduled } from "./collector/handler.js";
import { HEALTH_STATUS, SERVER_MANIFEST } from "./mcp/manifest.js";
import { MCPProtocolHandler } from "./mcp/protocol-handler.js";
import { createServices } from "./mcp-services/index.js";
import { logger } from "./mcp-utils/logger.js";
import { configureTelegram } from "./mcp-utils/telegram-notifier.js";
import type { Env } from "./shared/types.js";

const MCP_HOSTNAME = "mcp.apple-rag.com";

type HonoAppEnv = { Bindings: Env };

async function handleMCPRequest(c: {
	env: Env;
	executionCtx: ExecutionContext;
	req: { raw: Request };
}) {
	configureTelegram(c.env.TELEGRAM_DEFAULT_BOT_URL);
	logger.setContext(c.executionCtx);
	const services = await createServices(c.env);
	const authContext = await services.auth.optionalAuth(c.req.raw);
	const handler = new MCPProtocolHandler(services);
	return handler.handleRequest(c.req.raw, authContext);
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
	const body = [
		"User-agent: *",
		"Allow: /",
		"",
		"Disallow: /api/",
		"Disallow: /admin/",
		"Disallow: /overview",
		"Disallow: /settings",
		"Disallow: /messages",
		"Disallow: /usage",
		"Disallow: /authorized-ips",
		"Disallow: /mcp-tokens",
		"Disallow: /billing",
		"Disallow: /success",
		"Disallow: /design-system",
		"",
		"Sitemap: https://apple-rag.com/sitemap.xml",
	].join("\n");
	return c.text(body, 200, {
		"Content-Type": "text/plain",
		"Cache-Control": "public, max-age=86400",
	});
});

app.get("/sitemap.xml", (c) => {
	const base = "https://apple-rag.com";
	const pages = [
		{ loc: "/", priority: "1.0", changefreq: "daily" },
		{ loc: "/register", priority: "0.6", changefreq: "monthly" },
		{ loc: "/login", priority: "0.4", changefreq: "monthly" },
		{ loc: "/privacy-policy", priority: "0.2", changefreq: "yearly" },
		{ loc: "/terms-of-service", priority: "0.2", changefreq: "yearly" },
	];
	const today = new Date().toISOString().split("T")[0];
	const urls = pages
		.map(
			(p) =>
				`  <url>\n    <loc>${base}${p.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`,
		)
		.join("\n");
	const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
	return c.text(xml, 200, {
		"Content-Type": "application/xml",
		"Cache-Control": "public, max-age=86400",
	});
});

app.route("/api", apiApp);

app.get("/mcp/health", (c) => c.json({ ...HEALTH_STATUS, timestamp: new Date().toISOString() }));

app.get("/mcp/manifest", (c) =>
	c.json(SERVER_MANIFEST, 200, { "Cache-Control": "public, max-age=3600" }),
);

app.post("/mcp", (c) => handleMCPRequest(c));

app.on(["GET", "DELETE"], "/mcp", (c) =>
	c.text("Method Not Allowed", 405, {
		Allow: "POST, OPTIONS",
		"Access-Control-Allow-Origin": "*",
	}),
);

app.post("/api/collector/trigger", async (c) => {
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
			if (res.status === 404) {
				const url = new URL(c.req.url);
				url.pathname = "/";
				return c.env.ASSETS.fetch(new Request(url.toString(), c.req.raw));
			}
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
		origin: "*",
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization", "MCP-Protocol-Version"],
	}),
);

mcpApp.get("/health", (c) => c.json({ ...HEALTH_STATUS, timestamp: new Date().toISOString() }));

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

	async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
		await handleScheduled(env);
	},
};
