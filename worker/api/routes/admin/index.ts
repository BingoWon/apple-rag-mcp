/**
 * Admin API Routes
 * Password-protected administrative access and statistics.
 */
import { handleScheduled } from "../../../collector/handler.js";
import {
	formatIsoWeekKey,
	formatUtcDayKey,
	generateDocDigest,
} from "../../../services/doc-digest.js";
import { logger } from "../../utils/logger.js";
import { createOpenAPIApp } from "../../utils/openapi";
import { timingSafeEqual } from "../../utils/security.js";
import authorizedIPsAdmin from "./authorized-ips";
import clientsAdmin from "./clients";
import contactMessagesAdmin from "./contact-messages";
import fetchLogsAdmin from "./fetch-logs";
import mcpTokensAdmin from "./mcp-tokens";
import { resultLogs } from "./result-logs";
import statsAdmin from "./stats";
import userSubscriptionsAdmin from "./user-subscriptions";
import usersAdmin from "./users";

const ADMIN_PASSWORD_HEADER = "X-Admin-Password" as const;

const app = createOpenAPIApp();

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

	if (!(await timingSafeEqual(adminPassword, expectedPassword))) {
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
app.route("/stats", statsAdmin);
app.route("/clients", clientsAdmin);
app.route("/mcp-tokens", mcpTokensAdmin);
app.route("/authorized-ips", authorizedIPsAdmin);
app.route("/search-logs", resultLogs("search"));
app.route("/browse-logs", resultLogs("browse"));
app.route("/fetch-logs", fetchLogsAdmin);
app.route("/user-subscriptions", userSubscriptionsAdmin);
app.route("/contact-messages", contactMessagesAdmin);

app.post("/collector/trigger", async (c) => {
	try {
		await handleScheduled(c.env);
		return c.json({ success: true, data: { message: "Processing completed" } });
	} catch (error) {
		await logger.error(
			`Collector trigger failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		return c.json(
			{ success: false, error: { code: "INTERNAL_ERROR", message: "Processing failed" } },
			500,
		);
	}
});

app.post("/updates/generate-digest", async (c) => {
	try {
		const body = (await c.req.json().catch(() => ({}))) as {
			period_type?: "daily" | "weekly";
			days?: number;
			period_key?: string;
			force?: boolean;
		};
		const periodType = body.period_type === "weekly" ? "weekly" : "daily";
		const windowEnd = new Date();
		const defaultDays = periodType === "weekly" ? 7 : 1;
		const days = Math.min(30, Math.max(1, body.days ?? defaultDays));
		const windowStart = new Date(windowEnd.getTime() - days * 86_400_000);
		const periodKey =
			body.period_key?.trim() ||
			(periodType === "weekly" ? formatIsoWeekKey(windowEnd) : formatUtcDayKey(windowEnd));
		const digest = await generateDocDigest(c.env, {
			periodType,
			periodKey,
			windowStart,
			windowEnd,
			force: body.force ?? true,
		});
		return c.json({ success: true, data: digest });
	} catch (error) {
		await logger.error(
			`Admin digest generation failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		return c.json(
			{ success: false, error: { code: "INTERNAL_ERROR", message: "Digest generation failed" } },
			500,
		);
	}
});

// Admin dashboard info
app.get("/", (c) => {
	return c.json({
		success: true,
		data: {
			message: "Admin API - Password Protected",
			endpoints: [
				"/admin/users",
				"/admin/stats",
				"/admin/clients",
				"/admin/mcp-tokens",
				"/admin/authorized-ips",
				"/admin/search-logs",
				"/admin/browse-logs",
				"/admin/fetch-logs",
				"/admin/user-subscriptions",
				"/admin/contact-messages",
				"/admin/collector/trigger",
				"/admin/updates/generate-digest",
			],
			info: "Access protected by admin password authentication",
		},
	});
});

export default app;
