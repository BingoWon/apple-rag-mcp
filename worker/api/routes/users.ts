/**
 * User management routes
 * Implements user quota, statistics, and profile management
 */
import { createRoute, z } from "@hono/zod-openapi";
import { ApiErrorCode } from "../constants/error-codes";
import { authMiddleware } from "../middleware/auth";
import type { User } from "../types";
import { logger } from "../utils/logger";
import { createOpenAPIApp } from "../utils/openapi";

const app = createOpenAPIApp();

// Simplified response schemas
const QuotaResponseSchema = z.object({
	current_usage: z.number(),
	limit: z.number(),
	remaining: z.number(),
	reset_at: z.string(),
	usage_percentage: z.number(),
});

// Get user quota information (simplified)
const getUserQuotaRoute = createRoute({
	method: "get",
	path: "/quota",
	middleware: [authMiddleware],
	responses: {
		200: {
			description: "User quota information",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: QuotaResponseSchema,
					}),
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						error: z.object({
							code: z.string(),
							message: z.string(),
						}),
					}),
				},
			},
		},
		500: {
			description: "Internal server error",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						error: z.object({
							code: z.string(),
							message: z.string(),
						}),
					}),
				},
			},
		},
	},
	tags: ["Users"],
});

app.openapi(getUserQuotaRoute, async (c) => {
	const user = c.get("user") as User;

	try {
		// Get user's subscription plan type
		const { getUserPlanType, getPlanQuotas } = await import("../utils/subscription");
		const planType = await getUserPlanType(user.id, c.env.DB);
		const quotaLimits = getPlanQuotas(planType);

		// Get current week usage (successful RAG queries only)
		const now = new Date();
		const startOfWeek = new Date(now);
		startOfWeek.setDate(now.getDate() - now.getDay());
		startOfWeek.setHours(0, 0, 0, 0);

		// Get usage from both search_logs and fetch_logs tables
		const searchUsage = await c.env.DB.prepare(
			`SELECT COUNT(*) as count
       FROM search_logs
       WHERE user_id = ?
         AND created_at >= ?
         AND status_code = 200`,
		)
			.bind(user.id, startOfWeek.toISOString())
			.first();

		const fetchUsage = await c.env.DB.prepare(
			`SELECT COUNT(*) as count
       FROM fetch_logs
       WHERE user_id = ?
         AND created_at >= ?
         AND status_code = 200`,
		)
			.bind(user.id, startOfWeek.toISOString())
			.first();

		const searchCount = Number(searchUsage?.count) || 0;
		const fetchCount = Number(fetchUsage?.count) || 0;

		const currentUsage = searchCount + fetchCount;
		const remaining = Math.max(0, quotaLimits.week - currentUsage);
		const usagePercentage = Math.round((currentUsage / quotaLimits.week) * 100);

		// Calculate reset time (next Sunday)
		const resetAt = new Date(startOfWeek);
		resetAt.setDate(startOfWeek.getDate() + 7);

		const quotaResponse = {
			current_usage: currentUsage,
			limit: quotaLimits.week,
			remaining,
			reset_at: resetAt.toISOString(),
			usage_percentage: usagePercentage,
		};

		return c.json({ success: true, data: quotaResponse }, 200);
	} catch (error) {
		await logger.error(
			`Get user quota error: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
		return c.json(
			{
				success: false,
				error: {
					code: ApiErrorCode.INTERNAL_ERROR,
					message: "Failed to retrieve quota information",
				},
			},
			500,
		);
	}
});

// Tool calls stats schema
const ToolCallsStatsResponseSchema = z.object({
	total_tool_calls: z.number(),
	total_results: z.number(),
	calls_by_day: z.array(
		z.object({
			date: z.string(),
			tool_calls: z.number(),
			results: z.number(),
		}),
	),
});

// Get user tool calls statistics
const getUserToolCallsStatsRoute = createRoute({
	method: "get",
	path: "/usage/stats",
	middleware: [authMiddleware],
	request: {
		query: z.object({
			period: z.enum(["24h", "7d", "30d"]).optional().default("7d"),
		}),
	},
	responses: {
		200: {
			description: "User tool calls statistics",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: ToolCallsStatsResponseSchema,
					}),
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						error: z.object({
							code: z.string(),
							message: z.string(),
						}),
					}),
				},
			},
		},
		500: {
			description: "Internal server error",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						error: z.object({
							code: z.string(),
							message: z.string(),
						}),
					}),
				},
			},
		},
	},
	tags: ["Users"],
});

app.openapi(getUserToolCallsStatsRoute, async (c) => {
	const user = c.get("user") as User;
	const { period } = c.req.valid("query");

	try {
		// Calculate date range based on period (return raw timestamps)
		const startDate = new Date();
		const endDate = new Date();
		let startDateStr: string;
		let endDateStr: string;

		if (period === "24h") {
			// For 24h period, go back 24 hours from now
			startDate.setHours(startDate.getHours() - 24);
			startDateStr = startDate.toISOString();
			endDateStr = endDate.toISOString();
		} else {
			// For day periods (7d, 30d), calculate full date range
			const days = parseInt(period.replace("d", ""), 10);
			startDate.setDate(startDate.getDate() - days);
			startDate.setHours(0, 0, 0, 0); // Start of day
			endDate.setHours(23, 59, 59, 999); // End of day
			startDateStr = startDate.toISOString();
			endDateStr = endDate.toISOString();
		}

		// Get total tool calls from both search_logs and fetch_logs
		const totalToolCallsQuery = `SELECT
      (SELECT COUNT(*) FROM search_logs WHERE user_id = ? AND created_at >= ? AND created_at <= ?) +
      (SELECT COUNT(*) FROM fetch_logs WHERE user_id = ? AND created_at >= ? AND created_at <= ?) as total_tool_calls`;

		const totalToolCallsResult = await c.env.DB.prepare(totalToolCallsQuery)
			.bind(user.id, startDateStr, endDateStr, user.id, startDateStr, endDateStr)
			.first();

		// Get total results: search result_count + fetch count (each fetch = 1 result)
		const totalResultsQuery = `SELECT
      (SELECT SUM(CASE WHEN status_code = 200 THEN result_count ELSE 0 END) FROM search_logs WHERE user_id = ? AND created_at >= ? AND created_at <= ?) +
      (SELECT COUNT(*) FROM fetch_logs WHERE user_id = ? AND created_at >= ? AND created_at <= ? AND status_code = 200) as total_results`;

		const totalResultsResult = await c.env.DB.prepare(totalResultsQuery)
			.bind(user.id, startDateStr, endDateStr, user.id, startDateStr, endDateStr)
			.first();

		const totalToolCalls = Number(totalToolCallsResult?.total_tool_calls) || 0;
		const totalResults = Number(totalResultsResult?.total_results) || 0;

		// Get tool calls breakdown by combining search_logs and fetch_logs
		const toolCallsStatsQuery =
			period === "24h"
				? `WITH combined_logs AS (
          SELECT created_at, result_count, status_code FROM search_logs WHERE user_id = ? AND created_at >= ? AND created_at <= ?
          UNION ALL
          SELECT created_at, 1 as result_count, status_code FROM fetch_logs WHERE user_id = ? AND created_at >= ? AND created_at <= ?
        )
        SELECT
          created_at as date,
          COUNT(*) as tool_calls,
          SUM(CASE WHEN status_code = 200 THEN result_count ELSE 0 END) as results
        FROM combined_logs
        GROUP BY substr(created_at, 1, 13)
        ORDER BY created_at ASC`
				: `WITH combined_logs AS (
          SELECT created_at, result_count, status_code FROM search_logs WHERE user_id = ? AND created_at >= ? AND created_at <= ?
          UNION ALL
          SELECT created_at, 1 as result_count, status_code FROM fetch_logs WHERE user_id = ? AND created_at >= ? AND created_at <= ?
        )
        SELECT
          created_at as date,
          COUNT(*) as tool_calls,
          SUM(CASE WHEN status_code = 200 THEN result_count ELSE 0 END) as results
        FROM combined_logs
        GROUP BY substr(created_at, 1, 10)
        ORDER BY created_at ASC`;

		const toolCallsStatsResult = await c.env.DB.prepare(toolCallsStatsQuery)
			.bind(user.id, startDateStr, endDateStr, user.id, startDateStr, endDateStr)
			.all();

		// Return raw data without time formatting - let frontend handle it
		const usageByDay = (toolCallsStatsResult.results || []).map((row: Record<string, unknown>) => ({
			date: row.date, // Raw timestamp from database
			tool_calls: Number(row.tool_calls) || 0,
			results: Number(row.results) || 0,
		}));

		const statsResponse = {
			total_tool_calls: totalToolCalls,
			total_results: totalResults,
			calls_by_day: usageByDay,
		};

		return c.json({ success: true, data: statsResponse }, 200);
	} catch (error) {
		await logger.error(
			`Get user tool calls stats error: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
		return c.json(
			{
				success: false,
				error: {
					code: ApiErrorCode.INTERNAL_ERROR,
					message: "Failed to retrieve usage statistics",
				},
			},
			500,
		);
	}
});

// Update user profile (name only - email cannot be changed for security)
const updateProfileSchema = z.object({
	name: z.string().min(2, "Name must be at least 2 characters").optional(),
});

// Simplified route without complex OpenAPI schema
app.put("/profile", authMiddleware, async (c) => {
	const user = c.get("user") as User;

	try {
		const updates = await c.req.json();

		// Validate input
		const validatedUpdates = updateProfileSchema.parse(updates);

		// Email cannot be changed for security reasons - only name updates allowed

		// Build update query for name only
		if (!validatedUpdates.name) {
			return c.json(
				{
					success: false,
					error: {
						code: "NO_UPDATES",
						message: "No valid fields to update",
					},
				},
				400,
			);
		}

		// Update only name and timestamp
		await c.env.DB.prepare("UPDATE users SET name = ?, updated_at = ? WHERE id = ?")
			.bind(validatedUpdates.name, new Date().toISOString(), user.id)
			.run();

		// Fetch updated user data
		const updatedUser = (await c.env.DB.prepare(
			"SELECT id, email, name, created_at FROM users WHERE id = ?",
		)
			.bind(user.id)
			.first()) as User;

		return c.json({
			success: true,
			data: updatedUser,
		});
	} catch (error) {
		await logger.error(
			`Failed to update user profile for ${user.id}: ${error instanceof Error ? error.message : "Unknown error"}`,
		);

		return c.json(
			{
				success: false,
				error: {
					code: ApiErrorCode.INTERNAL_ERROR,
					message: "Failed to update profile",
				},
			},
			500,
		);
	}
});

// Delete user account (hard delete with cascade)
const deleteAccountRoute = createRoute({
	method: "delete",
	path: "/account",
	middleware: [authMiddleware],
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.object({
							message: z.string(),
						}),
					}),
				},
			},
			description: "Account deleted successfully",
		},
		401: {
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						error: z.object({
							code: z.string(),
							message: z.string(),
						}),
					}),
				},
			},
			description: "Unauthorized",
		},
		500: {
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						error: z.object({
							code: z.string(),
							message: z.string(),
						}),
					}),
				},
			},
			description: "Internal server error",
		},
	},
	tags: ["Users"],
});

app.openapi(deleteAccountRoute, async (c) => {
	const user = c.get("user") as User;

	try {
		// Hard delete user - CASCADE DELETE will automatically remove all associated data
		await c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(user.id).run();

		logger.info(
			`User account and all associated data deleted successfully: ${user.id} (${user.email})`,
		);

		return c.json(
			{
				success: true,
				data: {
					message: "Account has been deleted successfully",
				},
			},
			200,
		);
	} catch (error) {
		await logger.error(
			`Failed to delete user account for ${user.id}: ${error instanceof Error ? error.message : "Unknown error"}`,
		);

		return c.json(
			{
				success: false,
				error: {
					code: ApiErrorCode.INTERNAL_ERROR,
					message: "Failed to delete account",
				},
			},
			500,
		);
	}
});

export default app;
