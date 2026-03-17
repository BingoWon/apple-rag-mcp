/**
 * Admin User Subscriptions API
 * Administrative access to user_subscriptions table
 */
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppEnv } from "../../types/hono";
import { logger } from "../../utils/logger";

const app = new OpenAPIHono<AppEnv>();

// User subscription schema for admin view
const AdminUserSubscriptionSchema = z.object({
	user_id: z.string(),
	stripe_customer_id: z.string().nullable(),
	stripe_subscription_id: z.string().nullable(),
	plan_type: z.string(),
	status: z.string(),
	current_period_start: z.string().nullable(),
	current_period_end: z.string().nullable(),
	cancel_at_period_end: z.boolean(),
	price: z.number(),
	billing_interval: z.string(),
	stripe_price_id: z.string().nullable(),
	payment_type: z.string(),
	updated_at: z.string(),
	// Joined user data for display
	user_email: z.string().optional(),
	user_name: z.string().optional(),
});

const getUserSubscriptionsRoute = createRoute({
	method: "get",
	path: "/",
	summary: "Get user subscriptions with pagination",
	description: "Retrieve user subscriptions with pagination support",
	request: {
		query: z.object({
			limit: z.string().optional().default("50"),
			offset: z.string().optional().default("0"),
		}),
	},
	responses: {
		200: {
			description: "User subscriptions retrieved successfully",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.object({
							subscriptions: z.array(AdminUserSubscriptionSchema),
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

app.openapi(getUserSubscriptionsRoute, async (c) => {
	try {
		// Parse pagination parameters
		const limit = Math.min(Number(c.req.query("limit")) || 50, 100); // Max 100 per page
		const offset = Number(c.req.query("offset")) || 0;

		// Get total count
		const countResult = await c.env.DB.prepare(
			"SELECT COUNT(*) as total FROM user_subscriptions",
		).first();

		const total = Number(countResult?.total) || 0;

		// Get paginated user subscriptions with joined user data
		const subscriptionsResult = await c.env.DB.prepare(`
      SELECT
        us.user_id,
        us.stripe_customer_id,
        us.stripe_subscription_id,
        us.plan_type,
        us.status,
        us.current_period_start,
        us.current_period_end,
        us.cancel_at_period_end,
        us.price,
        us.billing_interval,
        us.stripe_price_id,
        us.payment_type,
        us.updated_at,
        u.email as user_email,
        u.name as user_name
      FROM user_subscriptions us
      LEFT JOIN users u ON us.user_id = u.id
      ORDER BY us.updated_at DESC
      LIMIT ? OFFSET ?
    `)
			.bind(limit, offset)
			.all();

		const subscriptions = (subscriptionsResult.results || []).map((row: any) => ({
			user_id: row.user_id,
			stripe_customer_id: row.stripe_customer_id,
			stripe_subscription_id: row.stripe_subscription_id,
			plan_type: row.plan_type || "hobby",
			status: row.status || "active",
			current_period_start: row.current_period_start,
			current_period_end: row.current_period_end,
			cancel_at_period_end: Boolean(row.cancel_at_period_end),
			price: Number(row.price) || 0,
			billing_interval: row.billing_interval || "month",
			stripe_price_id: row.stripe_price_id,
			payment_type: row.payment_type || "subscription",
			updated_at: row.updated_at,
			user_email: row.user_email || "N/A",
			user_name: row.user_name || "N/A",
		}));

		return c.json(
			{
				success: true,
				data: {
					subscriptions,
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
			`Failed to fetch user subscriptions for admin: ${error instanceof Error ? error.message : "Unknown error"}`,
		);

		return c.json(
			{
				success: false,
				error: {
					code: "DATABASE_ERROR",
					message: "Failed to fetch user subscriptions",
				},
			},
			500,
		);
	}
});

export default app;
