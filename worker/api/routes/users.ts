/**
 * User management routes
 * Implements user quota, statistics, and profile management
 */
import { createRoute, z } from "@hono/zod-openapi";
import { activitySchema, usagePeriod } from "../../../shared/tool-activity";
import { ApiErrorCode } from "../constants/error-codes";
import { authMiddleware } from "../middleware/auth";
import type { User } from "../types";
import { accountActivity } from "../utils/activity";
import { logger } from "../utils/logger";
import { createOpenAPIApp } from "../utils/openapi";
import { createStripeClient } from "../utils/stripe-client";
import { getPlanQuotas, getUserPlanType } from "../utils/subscription";

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
		const planType = await getUserPlanType(user.id, c.env.DB);
		const quotaLimits = getPlanQuotas(planType);

		const now = new Date();
		const startOfWeek = new Date(now);
		startOfWeek.setUTCDate(now.getUTCDate() - now.getUTCDay());
		startOfWeek.setUTCHours(0, 0, 0, 0);

		const usage = await c.env.DB.prepare(
			`SELECT count
			 FROM usage_counters
			 WHERE identifier = ? AND period = 'weekly' AND window_start = ?`,
		)
			.bind(user.id, startOfWeek.toISOString())
			.first();

		const currentUsage = Number(usage?.count) || 0;
		const remaining = quotaLimits.week === -1 ? -1 : Math.max(0, quotaLimits.week - currentUsage);
		const usagePercentage =
			quotaLimits.week === -1 ? 0 : Math.round((currentUsage / quotaLimits.week) * 100);

		const resetAt = new Date(startOfWeek);
		resetAt.setUTCDate(startOfWeek.getUTCDate() + 7);

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

// Get user tool calls statistics
const getUserToolCallsStatsRoute = createRoute({
	method: "get",
	path: "/usage/stats",
	middleware: [authMiddleware],
	request: {
		query: z.object({
			period: usagePeriod.default("7d"),
		}),
	},
	responses: {
		200: {
			description: "User tool calls statistics",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: activitySchema,
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
		const data = await accountActivity(c.env.DB, user.id, period);
		c.header("Cache-Control", "private, no-store");
		return c.json({ success: true, data }, 200);
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
	name: z
		.string()
		.trim()
		.min(2, "Name must be at least 2 characters")
		.max(100, "Name must not exceed 100 characters"),
});

// Simplified route without complex OpenAPI schema
app.put("/profile", authMiddleware, async (c) => {
	const user = c.get("user") as User;

	let updates: unknown;
	try {
		updates = await c.req.json();
	} catch {
		return c.json(
			{
				success: false,
				error: {
					code: ApiErrorCode.VALIDATION_ERROR,
					message: "Invalid JSON body",
				},
			},
			400,
		);
	}

	const parsed = updateProfileSchema.safeParse(updates);
	if (!parsed.success) {
		return c.json(
			{
				success: false,
				error: {
					code: ApiErrorCode.VALIDATION_ERROR,
					message: parsed.error.issues[0]?.message || "Invalid profile update",
				},
			},
			400,
		);
	}

	try {
		// Update only name and timestamp (email cannot be changed for security reasons)
		await c.env.DB.prepare("UPDATE users SET name = ?, updated_at = ? WHERE id = ?")
			.bind(parsed.data.name, new Date().toISOString(), user.id)
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
		const subscription = await c.env.DB.prepare(
			`SELECT payment_type, status, stripe_subscription_id
			 FROM user_subscriptions
			 WHERE user_id = ?`,
		)
			.bind(user.id)
			.first();

		if (
			subscription?.payment_type === "subscription" &&
			subscription.stripe_subscription_id &&
			subscription.status !== "canceled"
		) {
			try {
				await createStripeClient(c.env.STRIPE_SECRET_KEY).subscriptions.cancel(
					String(subscription.stripe_subscription_id),
				);
			} catch (stripeError) {
				const code =
					typeof stripeError === "object" && stripeError && "code" in stripeError
						? String(stripeError.code)
						: undefined;
				const statusCode =
					typeof stripeError === "object" && stripeError && "statusCode" in stripeError
						? Number(stripeError.statusCode)
						: undefined;
				const message = stripeError instanceof Error ? stripeError.message : String(stripeError);
				const alreadyGone =
					code === "resource_missing" ||
					statusCode === 404 ||
					/no such subscription|already canceled/i.test(message);
				if (!alreadyGone) throw stripeError;
			}
		}

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
