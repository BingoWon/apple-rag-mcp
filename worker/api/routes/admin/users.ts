/**
 * Admin Users API
 * Administrative access to users table
 */
import { createRoute, z } from "@hono/zod-openapi";
import { logger } from "../../utils/logger";
import { createOpenAPIApp } from "../../utils/openapi";
import { parsePagination } from "../../utils/pagination";
import { resolveSubscriptionState } from "../../utils/subscription";

import { adminSubscription, adminSubscriptionSchema } from "./user-identity";

const app = createOpenAPIApp();

// User schema for admin view (with sensitive data masked)
const AdminUserSchema = z.object({
	id: z.string(),
	email: z.string(),
	name: z.string(),
	provider: z.string().optional(),
	signup_source: z.string().nullable().optional(),
	avatar: z.string().optional(),
	plan_type: z.string(),
	subscription_status: z.string().nullable(),
	subscription: adminSubscriptionSchema,
	last_login: z.string().optional(),
	created_at: z.string(),
	updated_at: z.string(),
	// Sensitive fields excluded: password_hash, provider_id, reset_token, stripe_customer_id
});

const getUsersRoute = createRoute({
	method: "get",
	path: "/",
	summary: "Get users with pagination",
	description: "Retrieve users with pagination support",
	request: {
		query: z.object({
			limit: z.string().optional().default("50"),
			offset: z.string().optional().default("0"),
		}),
	},
	responses: {
		200: {
			description: "Users retrieved successfully",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.object({
							users: z.array(AdminUserSchema),
							total: z.number(),
							limit: z.number(),
							offset: z.number(),
							hasMore: z.boolean(),
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
	tags: ["Admin"],
});

app.openapi(getUsersRoute, async (c) => {
	try {
		// Parse pagination parameters
		const { limit, offset } = parsePagination(c.req.query("limit"), c.req.query("offset"));

		// Get total count
		const countResult = await c.env.DB.prepare("SELECT COUNT(*) as total FROM users").first();

		const total = Number(countResult?.total) || 0;

		// Get paginated users with subscription info (excluding sensitive fields)
		const usersResult = await c.env.DB.prepare(`
      SELECT
        u.id,
        u.email,
        u.name,
        u.provider,
        u.signup_source,
        u.avatar,
        u.last_login,
        u.created_at,
        u.updated_at,
        us.user_id as has_subscription,
        us.plan_type as raw_plan_type,
        us.status,
        us.payment_type,
        us.billing_interval,
        us.current_period_end,
        us.price,
        us.stripe_customer_id,
        us.stripe_subscription_id
      FROM users u
      LEFT JOIN user_subscriptions us ON u.id = us.user_id
      ORDER BY julianday(u.created_at) DESC, u.id DESC
      LIMIT ? OFFSET ?
    `)
			.bind(limit, offset)
			.all();

		const users = (usersResult.results || []).map((row: Record<string, unknown>) => {
			const subRow = row.has_subscription
				? {
						plan_type: row.raw_plan_type,
						status: row.status,
						payment_type: row.payment_type,
						billing_interval: row.billing_interval,
						current_period_end: row.current_period_end,
						price: row.price,
						stripe_customer_id: row.stripe_customer_id,
						stripe_subscription_id: row.stripe_subscription_id,
					}
				: null;
			const state = resolveSubscriptionState(subRow);
			return {
				subscription: adminSubscription(subRow),
				id: String(row.id),
				email: String(row.email),
				name: row.name ? String(row.name) : "",
				provider: String(row.provider || "email"),
				signup_source: row.signup_source ? String(row.signup_source) : null,
				avatar: row.avatar ? String(row.avatar) : undefined,
				plan_type: state.effectivePlan,
				subscription_status: subRow ? state.effectiveStatus : null,
				last_login: row.last_login ? String(row.last_login) : undefined,
				created_at: String(row.created_at),
				updated_at: String(row.updated_at),
			};
		});

		return c.json(
			{
				success: true,
				data: {
					users,
					total,
					limit,
					offset,
					hasMore: offset + limit < total,
				},
			},
			200,
		);
	} catch (error) {
		await logger.error(
			`Admin users fetch error: ${error instanceof Error ? error.message : "Unknown error"}`,
		);

		return c.json(
			{
				success: false,
				error: {
					code: "ADMIN_FETCH_ERROR",
					message: "Failed to fetch users data",
				},
			},
			500,
		);
	}
});

export default app;
