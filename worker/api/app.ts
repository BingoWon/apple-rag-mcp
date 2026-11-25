import { swaggerUI } from "@hono/swagger-ui";
import { bodyLimit } from "hono/body-limit";
import { logger as honoLogger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { requestId } from "hono/request-id";
import { timing } from "hono/timing";
import packageJson from "../../package.json";
import { createCLIRoutes } from "../cli/routes.js";
import { setGlobalAlertUrl } from "../shared/logger.js";
import { createCorsMiddleware, securityHeaders } from "./middleware/cors.js";
import adminRoutes from "./routes/admin/index.js";
import { authRoutes } from "./routes/auth.js";
import authorizedIPsRoutes from "./routes/authorized-ips.js";
import contactMessagesRoutes from "./routes/contact-messages.js";
import mcpTokenRoutes from "./routes/mcp-tokens.js";
import { oauthRoutes } from "./routes/oauth.js";
import statsRoutes from "./routes/stats.js";
import stripeRoutes from "./routes/stripe.js";
import updatesRoutes from "./routes/updates.js";
import usageLogsRoutes from "./routes/usage-logs.js";
import userRoutes from "./routes/users.js";
import { createOpenAPIApp } from "./utils/openapi.js";
import { configureTelegram } from "./utils/telegram-notifier.js";

const apiApp = createOpenAPIApp();

apiApp.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
	type: "http",
	scheme: "bearer",
	bearerFormat: "JWT",
});

// Callback URLs carry provider authorization codes. Keep those query strings out of request logs.
const requestLogger = honoLogger();
apiApp.use("*", (c, next) =>
	c.req.path.startsWith("/api/oauth/") ? next() : requestLogger(c, next),
);
apiApp.use("*", bodyLimit({ maxSize: 512 * 1024 }));
apiApp.use("*", requestId());
apiApp.use("*", timing());
apiApp.use(prettyJSON());

apiApp.onError(async (err, c) => {
	console.error(`Unhandled error in ${c.req.method} ${c.req.path}: ${err.message}`);
	return c.json(
		{ success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
		500,
	);
});

apiApp.use(async (c, next) => {
	const origin = new URL(c.req.url).origin;
	const corsMiddleware = createCorsMiddleware(origin);
	return corsMiddleware(c, next);
});
apiApp.use(securityHeaders);
apiApp.use("*", async (c, next) => {
	c.header("X-Robots-Tag", "noindex, nofollow");
	c.header("X-App-Version", packageJson.version);
	await next();
});

apiApp.use("*", async (c, next) => {
	configureTelegram({
		default: c.env.TELEGRAM_DEFAULT_BOT_URL,
		alerts: c.env.TELEGRAM_ALERT_BOT_URL,
	});
	setGlobalAlertUrl(c.env.TELEGRAM_ALERT_BOT_URL);
	await next();
});

apiApp.route("/auth", authRoutes);
apiApp.route("/cli", createCLIRoutes());
apiApp.route("/oauth", oauthRoutes);
apiApp.route("/contact-messages", contactMessagesRoutes);
apiApp.route("/users", userRoutes);
apiApp.route("/mcp-tokens", mcpTokenRoutes);
apiApp.route("/authorized-ips", authorizedIPsRoutes);
apiApp.route("/usage-logs", usageLogsRoutes);
apiApp.route("/admin", adminRoutes);
apiApp.route("/stripe", stripeRoutes);
apiApp.route("/stats", statsRoutes);
apiApp.route("/updates", updatesRoutes);

apiApp.get("/", (c) => c.json({ name: "Apple RAG API", version: packageJson.version }));

const OPENAPI_CONFIG = {
	openapi: "3.0.0",
	info: {
		version: packageJson.version,
		title: "Apple RAG API",
		description:
			"Platform API for Apple RAG accounts, subscriptions, and agent access. MCP and CLI use separate credentials and share account usage limits.",
	},
};

apiApp.get("/doc", (c) => {
	const document = apiApp.getOpenAPIDocument(OPENAPI_CONFIG);
	const publicPaths = Object.fromEntries(
		Object.entries(document.paths ?? {}).filter(([path]) => !path.startsWith("/admin")),
	);
	return c.json({ ...document, paths: publicPaths });
});

apiApp.get("/ui", swaggerUI({ url: "/api/doc", title: "Apple RAG API Reference" }));

export { apiApp };
