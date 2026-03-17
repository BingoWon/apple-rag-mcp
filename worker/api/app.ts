import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { logger as honoLogger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { requestId } from "hono/request-id";
import { timing } from "hono/timing";
import {
	createCorsMiddleware,
	preflightHandler,
	securityHeadersMiddleware,
} from "./middleware/cors";
import adminRoutes from "./routes/admin";
import { authRoutes } from "./routes/auth";
import authorizedIPsRoutes from "./routes/authorized-ips";
import contactMessagesRoutes from "./routes/contact-messages";
import mcpTokenRoutes from "./routes/mcp-tokens";
import { oauthRoutes } from "./routes/oauth";
import stripeRoutes from "./routes/stripe";
import usageLogsRoutes from "./routes/usage-logs";
import userRoutes from "./routes/users";
import type { AppEnv } from "./types/hono";
import { configureTelegram } from "./utils/telegram-notifier.js";

const apiApp = new OpenAPIHono<AppEnv>();

apiApp.use("*", honoLogger());
apiApp.use("*", requestId());
apiApp.use("*", timing());
apiApp.use(prettyJSON());

apiApp.onError(async (err, c) => {
	console.error(`Unhandled error in ${c.req.method} ${c.req.path}: ${err.message}`);
	return c.json(
		{
			success: false,
			error: {
				code: "INTERNAL_ERROR",
				message: "An unexpected error occurred",
			},
		},
		500,
	);
});

apiApp.use(preflightHandler);
apiApp.use(async (c, next) => {
	const corsMiddleware = createCorsMiddleware(c.env);
	return corsMiddleware(c, next);
});
apiApp.use(securityHeadersMiddleware);

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

apiApp.get("/", (c) => {
	return c.json({
		name: "Apple RAG API",
		version: "2.0.0",
		description: "API gateway for user management and MCP token services",
	});
});

apiApp.doc("/doc", {
	openapi: "3.0.0",
	info: {
		version: "2.0.0",
		title: "Apple RAG API",
		description: "API gateway for user management and MCP token services",
	},
});

apiApp.get("/ui", swaggerUI({ url: "/api/doc" }));

export { apiApp };
