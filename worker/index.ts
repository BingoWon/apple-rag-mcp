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

interface AppEnv {
	Bindings: Env;
}

// ─── MCP Handler (shared by both hostname and path routing) ──
async function handleMCPRequest(c: { env: Env; executionCtx: ExecutionContext; req: { raw: Request } }) {
	configureTelegram(c.env.TELEGRAM_DEFAULT_BOT_URL);
	logger.setContext(c.executionCtx);
	const services = await createServices(c.env);
	const authContext = await services.auth.optionalAuth(c.req.raw);
	const handler = new MCPProtocolHandler(services);
	return handler.handleRequest(c.req.raw, authContext);
}

// ─── Main App (apple-rag.com) ────────────────────────────────
const app = new Hono<AppEnv>();

app.onError((err, c) => {
	console.error("Unhandled error:", err instanceof Error ? err.message : String(err));
	return c.json({ error: { message: "Internal server error" } }, 500);
});

app.use(
	"*",
	cors({
		origin: "*",
		allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization", "X-Admin-Password"],
	}),
);

app.get("/health", (c) => c.json({ status: "ok" }));

app.route("/api", apiApp);

app.get("/mcp/health", (c) => {
	return c.json({ ...HEALTH_STATUS, timestamp: new Date().toISOString() });
});

app.get("/mcp/manifest", (c) => {
	return c.json(SERVER_MANIFEST, 200, { "Cache-Control": "public, max-age=3600" });
});

app.post("/mcp", (c) => handleMCPRequest(c));

app.post("/api/collector/trigger", async (c) => {
	try {
		await handleScheduled(c.env);
		return c.json({ message: "Processing completed" });
	} catch (_error) {
		return c.json({ error: "Processing failed" }, 500);
	}
});

app.notFound(async (c) => {
	if (c.req.path.startsWith("/api/") || c.req.path.startsWith("/mcp")) {
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
const mcpApp = new Hono<AppEnv>();

mcpApp.use(
	"*",
	cors({
		origin: "*",
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization", "MCP-Protocol-Version"],
	}),
);

mcpApp.get("/health", (c) => {
	return c.json({ ...HEALTH_STATUS, timestamp: new Date().toISOString() });
});

mcpApp.get("/manifest", (c) => {
	return c.json(SERVER_MANIFEST, 200, { "Cache-Control": "public, max-age=3600" });
});

mcpApp.post("/", (c) => handleMCPRequest(c));

mcpApp.all("*", (c) => {
	return c.json(
		{
			error: "MCP endpoint",
			message: "Send POST / for MCP protocol, GET /health for status, GET /manifest for discovery",
		},
		404,
	);
});

// ─── Router: dispatch by hostname ────────────────────────────
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const host = new URL(request.url).hostname;
		if (host === MCP_HOSTNAME) {
			return mcpApp.fetch(request, env, ctx);
		}
		return app.fetch(request, env, ctx);
	},

	async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		ctx.waitUntil(handleScheduled(env));
	},
};
