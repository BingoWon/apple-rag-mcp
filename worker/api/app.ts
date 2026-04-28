import { swaggerUI } from "@hono/swagger-ui";
import { logger as honoLogger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { requestId } from "hono/request-id";
import { timing } from "hono/timing";
import { createCorsMiddleware, securityHeaders } from "./middleware/cors.js";
import adminRoutes from "./routes/admin/index.js";
import { authRoutes } from "./routes/auth.js";
import authorizedIPsRoutes from "./routes/authorized-ips.js";
import contactMessagesRoutes from "./routes/contact-messages.js";
import mcpTokenRoutes from "./routes/mcp-tokens.js";
import { oauthRoutes } from "./routes/oauth.js";
import statsRoutes from "./routes/stats.js";
import stripeRoutes from "./routes/stripe.js";
import usageLogsRoutes from "./routes/usage-logs.js";
import userRoutes from "./routes/users.js";
import { createOpenAPIApp } from "./utils/openapi.js";
import { configureTelegram } from "./utils/telegram-notifier.js";

const apiApp = createOpenAPIApp();

apiApp.use("*", honoLogger());
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
	configureTelegram({
		default: c.env.TELEGRAM_DEFAULT_BOT_URL,
		alerts: c.env.TELEGRAM_ALERT_BOT_URL,
	});
	await next();
});

apiApp.route("/auth", authRoutes);
apiApp.route("/oauth", oauthRoutes);
apiApp.route("/contact-messages", contactMessagesRoutes);
apiApp.route("/users", userRoutes);
apiApp.route("/mcp-tokens", mcpTokenRoutes);
apiApp.route("/authorized-ips", authorizedIPsRoutes);
apiApp.route("/usage-logs", usageLogsRoutes);
apiApp.route("/admin", adminRoutes);
apiApp.route("/stripe", stripeRoutes);
apiApp.route("/stats", statsRoutes);

apiApp.get("/", (c) => c.json({ name: "Apple RAG API", version: "2.0.0" }));

apiApp.doc("/doc", {
	openapi: "3.0.0",
	info: { version: "2.0.0", title: "Apple RAG API" },
});

apiApp.get("/ui", swaggerUI({ url: "/api/doc" }));

export { apiApp };
