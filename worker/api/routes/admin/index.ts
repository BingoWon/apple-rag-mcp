/**
 * Admin API Routes
 * Provides administrative access to database tables for development/debugging
 * WARNING: No authentication - use only in development environment
 */
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types/hono";
import { logger } from "../../utils/logger.js";
import authorizedIPsAdmin from "./authorized-ips";
import contactMessagesAdmin from "./contact-messages";
import fetchLogsAdmin from "./fetch-logs";
import mcpTokensAdmin from "./mcp-tokens";
import searchLogsAdmin from "./search-logs";
import userSubscriptionsAdmin from "./user-subscriptions";
import usersAdmin from "./users";

// Admin authentication constants
const ADMIN_PASSWORD_HEADER = "X-Admin-Password" as const;

const app = new OpenAPIHono<AppEnv>();

// Admin password authentication
app.use("*", async (c, next) => {
	const adminPassword = c.req.header(ADMIN_PASSWORD_HEADER);
	const expectedPassword = c.env.ADMIN_PASSWORD;

	if (!expectedPassword) {
		return c.json(
			{
				success: false,
				error: {
					code: "CONFIGURATION_ERROR",
					message: "Admin password not configured",
				},
			},
			500,
		);
	}

	if (adminPassword !== expectedPassword) {
		// Log unauthorized access attempt
		logger.info(
			`Unauthorized admin access attempt from ${c.req.header("CF-Connecting-IP") || "unknown"} to ${c.req.path}`,
		);

		return c.json(
			{
				success: false,
				error: {
					code: "UNAUTHORIZED",
					message: "Invalid admin password",
				},
			},
			401,
		);
	}

	await next();
});

// Mount admin routes
app.route("/users", usersAdmin);
app.route("/mcp-tokens", mcpTokensAdmin);
app.route("/authorized-ips", authorizedIPsAdmin);
app.route("/search-logs", searchLogsAdmin);
app.route("/fetch-logs", fetchLogsAdmin);
app.route("/user-subscriptions", userSubscriptionsAdmin);
app.route("/contact-messages", contactMessagesAdmin);

// Admin dashboard info
app.get("/", (c) => {
	return c.json({
		success: true,
		data: {
			message: "Admin API - Password Protected",
			endpoints: [
				"/admin/users",
				"/admin/mcp-tokens",
				"/admin/authorized-ips",
				"/admin/search-logs",
				"/admin/fetch-logs",
				"/admin/user-subscriptions",
				"/admin/contact-messages",
			],
			info: "Access protected by admin password authentication",
		},
	});
});

export default app;
