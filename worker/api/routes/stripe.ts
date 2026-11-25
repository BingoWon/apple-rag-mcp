import type { Context } from "hono";
import type Stripe from "stripe";
import { z } from "zod";
import { ApiErrorCode } from "../constants/error-codes";
import { authMiddleware } from "../middleware/auth";
import { checkoutSession } from "../services/stripe-checkout";
import {
	endSubscription,
	fulfillPass,
	reconcileSubscription,
} from "../services/stripe-entitlements";
import type { AppEnv } from "../types/hono";
import { OAUTH_SUBSCRIPTION_QUOTAS } from "../types/permissions";
import { logger } from "../utils/logger.js";
import { createOpenAPIApp } from "../utils/openapi";
import { createStripeClient } from "../utils/stripe-client";
import {
	effectivePlanType,
	isTimestampExpired,
	resolveSubscriptionState,
} from "../utils/subscription";
import { recordSubscriptionReceipt } from "../utils/subscription-receipts";

const stripe = createOpenAPIApp();

// Apply auth middleware to protected routes BEFORE defining routes
stripe.use("/checkout", authMiddleware);
stripe.use("/subscription", authMiddleware);
stripe.use("/billing-portal", authMiddleware);

// Price mapping - direct object literal
const PRICES = {
	weekly: (env: AppEnv["Bindings"]) => env.STRIPE_PRICE_ID_PRO_WEEKLY,
	monthly: (env: AppEnv["Bindings"]) => env.STRIPE_PRICE_ID_PRO_MONTHLY,
	semiannual: (env: AppEnv["Bindings"]) => env.STRIPE_PRICE_ID_PRO_SEMIANNUAL,
	annual: (env: AppEnv["Bindings"]) => env.STRIPE_PRICE_ID_PRO_ANNUAL,
	onetime_weekly: (env: AppEnv["Bindings"]) => env.STRIPE_PRICE_ID_PRO_ONETIME_WEEKLY,
	onetime_monthly: (env: AppEnv["Bindings"]) => env.STRIPE_PRICE_ID_PRO_ONETIME_MONTHLY,
	onetime_semiannual: (env: AppEnv["Bindings"]) => env.STRIPE_PRICE_ID_PRO_ONETIME_SEMIANNUAL,
	onetime_annual: (env: AppEnv["Bindings"]) => env.STRIPE_PRICE_ID_PRO_ONETIME_ANNUAL,
} as const;

const PRICES_CNY: Partial<Record<keyof typeof PRICES, (env: AppEnv["Bindings"]) => string>> = {
	onetime_weekly: (env) => env.STRIPE_PRICE_ID_PRO_ONETIME_WEEKLY_CNY,
	onetime_monthly: (env) => env.STRIPE_PRICE_ID_PRO_ONETIME_MONTHLY_CNY,
	onetime_semiannual: (env) => env.STRIPE_PRICE_ID_PRO_ONETIME_SEMIANNUAL_CNY,
	onetime_annual: (env) => env.STRIPE_PRICE_ID_PRO_ONETIME_ANNUAL_CNY,
};

// Create checkout session
stripe.openapi(
	{
		method: "post",
		path: "/checkout",
		summary: "Create Stripe checkout session",
		security: [{ bearerAuth: [] }],
		request: {
			body: {
				content: {
					"application/json": {
						schema: z.object({
							priceId: z.enum([
								"weekly",
								"monthly",
								"semiannual",
								"annual",
								"onetime_weekly",
								"onetime_monthly",
								"onetime_semiannual",
								"onetime_annual",
							]),
							cancelUrl: z.string().optional(),
							paymentMethod: z.enum(["card", "alipay"]).optional(),
						}),
					},
				},
			},
		},
		responses: {
			200: {
				description: "Checkout session created successfully",
				content: {
					"application/json": {
						schema: z.object({
							success: z.boolean(),
							data: z.object({ url: z.string() }),
						}),
					},
				},
			},
			400: {
				description: "Bad request - invalid price ID",
				content: {
					"application/json": {
						schema: z.object({
							success: z.boolean(),
							error: z.object({ code: z.string(), message: z.string() }),
						}),
					},
				},
			},
			409: {
				description: "Conflict - pending checkout session",
				content: {
					"application/json": {
						schema: z.object({
							success: z.boolean(),
							error: z.object({ code: z.string(), message: z.string() }),
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
	},
	async (c) => {
		try {
			const { priceId, cancelUrl, paymentMethod } = c.req.valid("json");
			const user = c.get("user");

			if (!c.env.STRIPE_SECRET_KEY) {
				return c.json(
					{
						success: false,
						error: {
							code: ApiErrorCode.SERVICE_UNAVAILABLE,
							message: "Stripe configuration error",
						},
					},
					500,
				);
			}

			const useAlipay = paymentMethod === "alipay" && priceId.startsWith("onetime_");
			const priceLookup = useAlipay
				? PRICES_CNY[priceId as keyof typeof PRICES]
				: PRICES[priceId as keyof typeof PRICES];
			const priceIdValue = priceLookup?.(c.env);
			if (!priceIdValue) {
				return c.json(
					{
						success: false,
						error: { code: ApiErrorCode.INVALID_REQUEST, message: "Invalid price ID" },
					},
					400,
				);
			}

			const isOneTime = priceId.startsWith("onetime_");

			const existing = await c.env.DB.prepare(
				"SELECT payment_type, status, current_period_end, plan_type,stripe_subscription_id,stripe_customer_id FROM user_subscriptions WHERE user_id = ?",
			)
				.bind(user.id)
				.first();

			if (existing) {
				const hasActiveSubscription =
					existing.payment_type === "subscription" && !!existing.stripe_subscription_id;
				const hasActiveOneTime =
					existing.payment_type === "one_time" &&
					!!existing.current_period_end &&
					!isTimestampExpired(existing.current_period_end);

				if (hasActiveSubscription && !isOneTime && existing.stripe_customer_id) {
					const portal = await createStripeClient(
						c.env.STRIPE_SECRET_KEY,
					).billingPortal.sessions.create({
						customer: String(existing.stripe_customer_id),
						return_url: new URL("/billing", c.req.url).href,
					});
					return c.json({ success: true as const, data: { url: portal.url } }, 200);
				}
				if (hasActiveSubscription) {
					return c.json(
						{
							success: false,
							error: {
								code: ApiErrorCode.INVALID_REQUEST,
								message: "CONFLICT_SUBSCRIPTION_ACTIVE",
							},
						},
						400,
					);
				}

				if (hasActiveOneTime && !isOneTime) {
					return c.json(
						{
							success: false,
							error: {
								code: ApiErrorCode.INVALID_REQUEST,
								message: "CONFLICT_ONETIME_ACTIVE",
							},
						},
						400,
					);
				}
			}

			const origin = new URL(c.req.url).origin;
			let finalCancelUrl = `${origin}/#pricing`;
			if (cancelUrl) {
				try {
					const back = new URL(cancelUrl, origin);
					if (back.origin === origin) finalCancelUrl = back.href;
				} catch {
					// Malformed cancelUrl falls back to default pricing anchor
				}
			}

			const stripeClient = createStripeClient(c.env.STRIPE_SECRET_KEY);

			const sessionParams: Stripe.Checkout.SessionCreateParams = {
				line_items: [{ price: priceIdValue, quantity: 1 }],
				mode: isOneTime ? "payment" : "subscription",
				success_url: `${origin}/success`,
				cancel_url: finalCancelUrl,
				client_reference_id: user.id,
				...(existing?.stripe_customer_id
					? { customer: String(existing.stripe_customer_id) }
					: { customer_email: user.email }),
				metadata: {
					userId: user.id,
					planType: "pro",
					paymentType: isOneTime ? "one_time" : "subscription",
					priceId,
				},
				allow_promotion_codes: !useAlipay,
				billing_address_collection: "auto",
			};

			if (useAlipay) {
				sessionParams.payment_method_types = ["alipay"];
			}

			if (!isOneTime) {
				sessionParams.subscription_data = {
					metadata: { userId: user.id, planType: "pro" },
				};
			}

			const session = await checkoutSession(
				c.env.DB,
				stripeClient,
				user.id,
				priceIdValue,
				sessionParams,
			);
			if (!session)
				return c.json(
					{
						success: false,
						error: { code: ApiErrorCode.RESOURCE_CONFLICT, message: "CHECKOUT_PENDING" },
					},
					409,
				);

			return c.json({ success: true as const, data: { url: session.url! } }, 200);
		} catch (error) {
			await logger.error(
				`Failed to create checkout session: ${error instanceof Error ? error.message : String(error)}`,
			);
			return c.json(
				{
					success: false,
					error: {
						code: ApiErrorCode.INTERNAL_ERROR,
						message: "Failed to create checkout session",
					},
				},
				500,
			);
		}
	},
);

// Create billing portal session
stripe.openapi(
	{
		method: "post",
		path: "/billing-portal",
		summary: "Create Stripe billing portal session",
		security: [{ bearerAuth: [] }],
		responses: {
			200: {
				description: "Billing portal session created successfully",
				content: {
					"application/json": {
						schema: z.object({
							success: z.boolean(),
							data: z.object({ url: z.string() }),
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
							error: z.object({ code: z.string(), message: z.string() }),
						}),
					},
				},
			},
			404: {
				description: "No subscription found",
				content: {
					"application/json": {
						schema: z.object({
							success: z.boolean(),
							error: z.object({ code: z.string(), message: z.string() }),
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
							error: z.object({ code: z.string(), message: z.string() }),
						}),
					},
				},
			},
		},
	},
	async (c) => {
		const user = c.get("user");
		if (!user) {
			return c.json(
				{ success: false, error: { code: ApiErrorCode.UNAUTHORIZED, message: "Unauthorized" } },
				401,
			);
		}

		try {
			// Get user's Stripe customer ID
			const result = await c.env.DB.prepare(`
        SELECT stripe_customer_id
        FROM user_subscriptions
        WHERE user_id = ?
        ORDER BY updated_at DESC
        LIMIT 1
      `)
				.bind(user.id)
				.first();

			if (!result?.stripe_customer_id) {
				return c.json(
					{
						success: false,
						error: {
							code: ApiErrorCode.SUBSCRIPTION_NOT_FOUND,
							message: "No billing information found",
						},
					},
					404,
				);
			}

			// Create Stripe client
			const stripeClient = createStripeClient(c.env.STRIPE_SECRET_KEY);

			// Create billing portal session with return URL that triggers refresh
			const session = await stripeClient.billingPortal.sessions.create({
				customer: result.stripe_customer_id as string,
				return_url: `${new URL(c.req.url).origin}/billing`,
			});

			return c.json({ success: true as const, data: { url: session.url } }, 200);
		} catch (error) {
			console.error("Failed to create billing portal session:", error);
			return c.json(
				{
					success: false,
					error: {
						code: ApiErrorCode.INTERNAL_ERROR,
						message: "Failed to create billing portal session",
					},
				},
				500,
			);
		}
	},
);

// Get subscription status
stripe.openapi(
	{
		method: "get",
		path: "/subscription",
		summary: "Get user subscription status",
		security: [{ bearerAuth: [] }],
		responses: {
			200: {
				description: "User subscription information",
				content: {
					"application/json": {
						schema: z.object({
							success: z.boolean(),
							data: z.object({
								id: z.string(),
								plan_id: z.enum(["hobby", "pro", "enterprise"]),
								plan_name: z.string(),
								status: z.enum([
									"active",
									"canceled",
									"past_due",
									"trialing",
									"incomplete",
									"inactive",
									"expired",
								]),
								subscribed_plan_id: z.enum(["hobby", "pro", "enterprise"]).optional(),
								entitlement_source: z.enum([
									"free",
									"stripe_subscription",
									"one_time_pass",
									"complimentary",
								]),
								has_active_stripe_subscription: z.boolean(),
								can_manage_billing: z.boolean(),
								current_period_start: z.string().optional(),
								current_period_end: z.string().optional(),
								cancel_at_period_end: z.boolean(),
								weekly_quota: z.number(),
								minute_quota: z.number(),
								price: z.number(),
								currency: z.string().nullable(),
								billing_interval: z.string(),
								payment_type: z.enum(["subscription", "one_time"]),
								stripe_customer_id: z.string().optional(),
							}),
						}),
					},
				},
			},
		},
	},
	async (c) => {
		const user = c.get("user");
		const result = await c.env.DB.prepare("SELECT * FROM user_subscriptions WHERE user_id = ?")
			.bind(user.id)
			.first();

		const PLAN_NAMES: Record<string, string> = {
			hobby: "Hobby",
			pro: "Pro",
			enterprise: "Enterprise",
		};

		const state = resolveSubscriptionState(result);
		const planType = effectivePlanType(result);
		const quota = OAUTH_SUBSCRIPTION_QUOTAS[planType] || OAUTH_SUBSCRIPTION_QUOTAS.hobby;

		return c.json({
			success: true,
			data: {
				id: state.stripeSubscriptionId ?? `mock_${user.id}`,
				plan_id: planType,
				plan_name: PLAN_NAMES[planType] || "Hobby",
				subscribed_plan_id: state.subscribedPlan,
				entitlement_source: state.entitlementSource,
				has_active_stripe_subscription: state.hasActiveStripeSubscription,
				can_manage_billing: state.canManageBilling,
				status: state.effectiveStatus,
				current_period_start: state.currentPeriodStart,
				current_period_end: state.currentPeriodEnd,
				cancel_at_period_end: state.cancelAtPeriodEnd,
				weekly_quota: quota.week,
				minute_quota: quota.minute,
				price: state.price,
				currency: state.currency,
				billing_interval: state.billingInterval,
				payment_type: state.paymentType,
				stripe_customer_id: state.stripeCustomerId,
			},
		});
	},
);

class WebhookSignatureError extends Error {}

stripe.post("/webhook", async (c) => {
	let eventId = "unknown";

	try {
		const { event, stripeClient } = await validateWebhook(c);
		eventId = event.id;
		const objectId = getEventObjectId(event);

		if (
			await c.env.DB.prepare("SELECT 1 FROM stripe_events WHERE event_id=?").bind(event.id).first()
		) {
			return c.json({
				received: true,
				eventId: event.id,
				processed: true,
				message: "Duplicate event ignored",
			});
		}

		logger.info(`🔔 [STRIPE WEBHOOK] Processing event ${event.type} (${event.id})`);
		const message = await processWebhookEvent(event, stripeClient, c.env.DB);

		await recordProcessedEvent(c.env.DB, event, objectId);
		logger.info(`🔔 [STRIPE WEBHOOK] Event ${event.type} (${event.id}) processed: ${message}`);

		return c.json({
			received: true,
			eventId: event.id,
			processed: true,
			message,
		});
	} catch (error) {
		if (error instanceof WebhookSignatureError) {
			return c.json(
				{
					received: false,
					error: error.message,
				},
				400,
			);
		}

		await logger.error(
			`🔔 [STRIPE WEBHOOK] Critical error for event ${eventId}: ${error instanceof Error ? error.message : String(error)}`,
		);

		return c.json(
			{
				received: true,
				eventId,
				processed: false,
				error: "Webhook processing failed",
			},
			500,
		);
	}
});

function getEventObjectId(event: Stripe.Event): string {
	const object = event.data.object as { id?: string };
	return object.id || event.id;
}

async function recordProcessedEvent(
	db: D1Database,
	event: Stripe.Event,
	objectId: string,
): Promise<void> {
	await db
		.prepare(
			`INSERT INTO stripe_events (event_id, event_type, object_id, created_at, processed_at)
			 VALUES (?, ?, ?, ?, ?) ON CONFLICT(event_id) DO NOTHING`,
		)
		.bind(event.id, event.type, objectId, event.created, new Date().toISOString())
		.run();
}

/**
 * Validate webhook signature and parse event
 */
async function validateWebhook(c: Context<AppEnv>) {
	const body = await c.req.text();
	const signature = c.req.header("stripe-signature");

	if (!signature) {
		throw new WebhookSignatureError("Missing Stripe signature");
	}

	if (!c.env.STRIPE_WEBHOOK_SECRET) {
		throw new Error("Webhook secret not configured");
	}

	const stripeClient = createStripeClient(c.env.STRIPE_SECRET_KEY);

	try {
		const event = await stripeClient.webhooks.constructEventAsync(
			body,
			signature,
			c.env.STRIPE_WEBHOOK_SECRET,
		);
		return { event, stripeClient };
	} catch (error) {
		throw new WebhookSignatureError(
			error instanceof Error ? error.message : "Invalid Stripe signature",
		);
	}
}

/**
 * Process webhook event with graceful error handling
 */
async function processWebhookEvent(event: Stripe.Event, stripeClient: Stripe, db: D1Database) {
	switch (event.type) {
		case "invoice.paid":
			await recordSubscriptionReceipt(db, event.data.object);
			return "Subscription receipt recorded";
		case "customer.subscription.created":
		case "customer.subscription.updated": {
			const sub = event.data.object;
			const userId =
				sub.metadata?.userId ??
				(
					await db
						.prepare("SELECT user_id FROM user_subscriptions WHERE stripe_customer_id=?")
						.bind(typeof sub.customer === "string" ? sub.customer : sub.customer.id)
						.first<{ user_id: string }>()
				)?.user_id;
			if (!userId) throw Error("No local owner for subscription " + sub.id);
			await reconcileSubscription(db, stripeClient, userId, sub.id, event.created);
			return "Subscription processed";
		}
		case "customer.subscription.deleted": {
			const sub = event.data.object;
			await endSubscription(db, sub.id, event.created, sub.metadata?.attempt);
			return "Subscription ended";
		}
		case "checkout.session.completed":
		case "checkout.session.async_payment_succeeded": {
			const session = event.data.object;
			return session.mode === "payment"
				? fulfillPass(db, session)
				: "Recurring checkout handled by subscription events";
		}
		case "checkout.session.expired":
		case "checkout.session.async_payment_failed": {
			const session = event.data.object;
			await db
				.prepare("DELETE FROM checkout_attempts WHERE attempt_id=?")
				.bind(session.metadata?.attempt ?? "")
				.run();
			return "Checkout closed";
		}
		default:
			return "Event acknowledged";
	}
}

export default stripe;
