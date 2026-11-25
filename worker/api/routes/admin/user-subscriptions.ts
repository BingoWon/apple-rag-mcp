/**
 * Admin User Subscriptions API
 * Administrative access to user_subscriptions table
 */
import { createRoute, z } from "@hono/zod-openapi";
import { logger } from "../../utils/logger";
import { createOpenAPIApp } from "../../utils/openapi";
import { parsePagination } from "../../utils/pagination";
import { resolveSubscriptionState } from "../../utils/subscription";
import { adminUserSchema, withAdminUsers } from "./user-identity";

const app = createOpenAPIApp();

// User subscription schema for admin view
const AdminUserSubscriptionSchema = z.object({
	user: adminUserSchema,
	plan_type: z.string(),
	status: z.string(),
	entitlement_source: z.enum(["free", "stripe_subscription", "one_time_pass", "complimentary"]),
	is_stripe_managed: z.boolean(),
	current_period_start: z.string().nullable(),
	current_period_end: z.string().nullable(),
	cancel_at_period_end: z.boolean(),
	price: z.number(),
	currency: z.string().nullable(),
	billing_interval: z.string(),
	payment_type: z.string(),
	updated_at: z.string(),
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
		const { limit, offset } = parsePagination(c.req.query("limit"), c.req.query("offset"));

		// Get total count
		const countResult = await c.env.DB.prepare(
			"SELECT COUNT(*) as total FROM user_subscriptions",
		).first();

		const total = Number(countResult?.total) || 0;

		// Get paginated user subscriptions (internal Stripe IDs used only for state derivation, never returned)
		const subscriptionsResult = await c.env.DB.prepare(`
      SELECT
        us.user_id,
        us.plan_type,
        us.status,
        us.current_period_start,
        us.current_period_end,
        us.cancel_at_period_end,
        us.price,
        us.currency,
        us.billing_interval,
        us.payment_type,
        us.stripe_customer_id,
        us.stripe_subscription_id,
        us.updated_at
      FROM user_subscriptions us
      ORDER BY julianday(us.updated_at) DESC, us.user_id DESC
      LIMIT ? OFFSET ?
    `)
			.bind(limit, offset)
			.all();

		const subscriptions = (subscriptionsResult.results || []).map(
			(row: Record<string, unknown>) => {
				const state = resolveSubscriptionState(row);
				return {
					user_id: String(row.user_id),
					plan_type: state.subscribedPlan,
					status: state.effectiveStatus,
					entitlement_source: state.entitlementSource,
					is_stripe_managed: state.isStripeManaged,
					current_period_start: state.currentPeriodStart ?? null,
					current_period_end: state.currentPeriodEnd ?? null,
					cancel_at_period_end: state.cancelAtPeriodEnd,
					price: state.price,
					currency: state.currency,
					billing_interval: state.billingInterval,
					payment_type: state.paymentType,
					updated_at: String(row.updated_at),
				};
			},
		);

		return c.json(
			{
				success: true,
				data: {
					subscriptions: await withAdminUsers(c.env.DB, subscriptions),
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
