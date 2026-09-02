import type { Context } from "hono";
import type Stripe from "stripe";
import { z } from "zod";
import { ApiErrorCode } from "../constants/error-codes";
import { authMiddleware } from "../middleware/auth";
import type { AppEnv } from "../types/hono";
import { OAUTH_SUBSCRIPTION_QUOTAS } from "../types/permissions";
import { logger } from "../utils/logger.js";
import { createOpenAPIApp } from "../utils/openapi";
import { createStripeClient } from "../utils/stripe-client";
import { notifyTelegram } from "../utils/telegram-notifier";

const stripe = createOpenAPIApp();

function formatBillingInterval(interval: string, intervalCount: number): string {
	if (interval === "month" && intervalCount === 6) return "6 months";
	if (intervalCount === 1) return interval;
	return `${intervalCount} ${interval}${intervalCount > 1 ? "s" : ""}`;
}

function extractSubscriptionPeriod(subscription: Stripe.Subscription) {
	const firstItem = subscription.items?.data?.[0];
	if (!firstItem) {
		logger.warn(`[STRIPE] No subscription items found for ${subscription.id}`);
		return { start: null, end: null };
	}

	const start = firstItem.current_period_start
		? new Date(firstItem.current_period_start * 1000).toISOString()
		: null;
	const end = firstItem.current_period_end
		? new Date(firstItem.current_period_end * 1000).toISOString()
		: null;

	return { start, end };
}

async function extractSubscriptionPricing(subscription: Stripe.Subscription, stripeClient: Stripe) {
	const firstItem = subscription.items?.data?.[0];
	if (!firstItem) {
		logger.warn(`[STRIPE] No subscription items found for ${subscription.id}`);
		return { price: 0, billingInterval: "month", priceId: null };
	}

	try {
		const priceObject = await stripeClient.prices.retrieve(firstItem.price.id);
		const price = priceObject.unit_amount ? priceObject.unit_amount / 100 : 0;
		const billingInterval = formatBillingInterval(
			priceObject.recurring?.interval || "month",
			priceObject.recurring?.interval_count || 1,
		);

		return { price, billingInterval, priceId: priceObject.id };
	} catch (error) {
		await logger.error(
			`[STRIPE] Error fetching price for ${firstItem.price.id}: ${error instanceof Error ? error.message : "Unknown error"}`,
		);

		const price = firstItem.price.unit_amount ? firstItem.price.unit_amount / 100 : 0;
		const billingInterval = formatBillingInterval(
			firstItem.price.recurring?.interval || "month",
			firstItem.price.recurring?.interval_count || 1,
		);

		return { price, billingInterval, priceId: firstItem.price.id };
	}
}

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

const ONETIME_DURATIONS: Record<string, number> = {
	onetime_weekly: 7,
	onetime_monthly: 30,
	onetime_semiannual: 180,
	onetime_annual: 365,
};

const ONETIME_INTERVALS: Record<string, string> = {
	onetime_weekly: "week",
	onetime_monthly: "month",
	onetime_semiannual: "6 months",
	onetime_annual: "year",
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
			500: {
				description: "Internal server error",
				content: {
					"application/json": {
						schema: z.object({
							success: z.boolean(),
							error: z.object({
								code: z.string(),
								message: z.string(),
								details: z.string().optional(),
							}),
						}),
					},
				},
			},
		},
	},
	async (c) => {
		try {
			const { priceId, cancelUrl, paymentMethod } = await c.req.json();
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
				"SELECT payment_type, status, current_period_end, plan_type FROM user_subscriptions WHERE user_id = ?",
			)
				.bind(user.id)
				.first();

			if (existing) {
				const hasActiveSubscription =
					existing.payment_type === "subscription" &&
					existing.status === "active" &&
					existing.plan_type !== "hobby";
				const hasActiveOneTime =
					existing.payment_type === "one_time" &&
					existing.current_period_end &&
					new Date(existing.current_period_end as string) > new Date();

				if (hasActiveSubscription && isOneTime) {
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
			const finalCancelUrl = cancelUrl || `${origin}/#pricing`;

			const stripeClient = createStripeClient(c.env.STRIPE_SECRET_KEY);

			const sessionParams: Stripe.Checkout.SessionCreateParams = {
				line_items: [{ price: priceIdValue, quantity: 1 }],
				mode: isOneTime ? "payment" : "subscription",
				success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
				cancel_url: finalCancelUrl,
				client_reference_id: user.id,
				customer_email: user.email,
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

			const session = await stripeClient.checkout.sessions.create(sessionParams);

			return c.json({ success: true as const, data: { url: session.url! } }, 200);
		} catch (error) {
			return c.json(
				{
					success: false,
					error: {
						code: ApiErrorCode.INTERNAL_ERROR,
						message: "Failed to create checkout session",
						details: error instanceof Error ? error.message : "Unknown error",
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
				return_url: `${new URL(c.req.url).origin}/billing?refresh=true`,
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
								]),
								current_period_start: z.string().optional(),
								current_period_end: z.string().optional(),
								cancel_at_period_end: z.boolean(),
								weekly_quota: z.number(),
								minute_quota: z.number(),
								price: z.number(),
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

		let planType = (result?.plan_type as string) || "hobby";
		const paymentType = (result?.payment_type as string) || "subscription";
		let status = (result?.status as string) || "active";

		if (
			paymentType === "one_time" &&
			result?.current_period_end &&
			new Date(result.current_period_end as string) < new Date()
		) {
			planType = "hobby";
			status = "inactive";
		}

		const quota = OAUTH_SUBSCRIPTION_QUOTAS[planType] || OAUTH_SUBSCRIPTION_QUOTAS.hobby;
		const price = result?.price ?? 0;
		const billingInterval = result?.billing_interval ?? "month";

		return c.json({
			success: true,
			data: {
				id: result?.stripe_subscription_id
					? String(result.stripe_subscription_id)
					: `mock_${user.id}`,
				plan_id: planType as "hobby" | "pro" | "enterprise",
				plan_name: PLAN_NAMES[planType] || "Hobby",
				status: status as
					| "active"
					| "canceled"
					| "past_due"
					| "trialing"
					| "incomplete"
					| "inactive",
				current_period_start: result?.current_period_start
					? String(result.current_period_start)
					: undefined,
				current_period_end: result?.current_period_end
					? String(result.current_period_end)
					: undefined,
				cancel_at_period_end: Boolean(result?.cancel_at_period_end),
				weekly_quota: quota.week,
				minute_quota: quota.minute,
				price: Number(price),
				billing_interval: String(billingInterval),
				payment_type: paymentType as "subscription" | "one_time",
				stripe_customer_id: result?.stripe_customer_id
					? String(result.stripe_customer_id)
					: undefined,
			},
		});
	},
);

stripe.post("/webhook", async (c) => {
	const eventId = c.req.header("stripe-signature")?.split(",")[0]?.split("=")[1] || "unknown";

	try {
		const { event, stripeClient } = await validateWebhook(c);
		const objectId = getEventObjectId(event);

		if (await hasProcessedEvent(c.env.DB, event, objectId)) {
			return c.json({
				received: true,
				eventId: event.id,
				processed: true,
				message: "Duplicate event ignored",
			});
		}

		logger.info(`🔔 [STRIPE WEBHOOK] Processing event ${event.type} (${event.id})`);
		const result = await processWebhookEvent(event, stripeClient, c.env.DB);

		if (!result.success) {
			throw new Error(result.message);
		}

		await recordProcessedEvent(c.env.DB, event, objectId);
		logger.info(
			`🔔 [STRIPE WEBHOOK] Event ${event.type} (${event.id}) processed: ${result.message}`,
		);

		return c.json({
			received: true,
			eventId: event.id,
			processed: true,
			message: result.message,
		});
	} catch (error) {
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

async function hasProcessedEvent(
	db: D1Database,
	event: Stripe.Event,
	objectId: string,
): Promise<boolean> {
	const existing = await db
		.prepare(
			`SELECT 1 FROM stripe_events
			 WHERE event_id = ?
			    OR (event_type = 'checkout.session.completed' AND event_type = ? AND object_id = ?)
			 LIMIT 1`,
		)
		.bind(event.id, event.type, objectId)
		.first();

	return Boolean(existing);
}

async function recordProcessedEvent(
	db: D1Database,
	event: Stripe.Event,
	objectId: string,
): Promise<void> {
	await db
		.prepare(
			`INSERT INTO stripe_events (event_id, event_type, object_id, created_at, processed_at)
			 VALUES (?, ?, ?, ?, ?)`,
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
		throw new Error("Missing Stripe signature");
	}

	if (!c.env.STRIPE_WEBHOOK_SECRET) {
		throw new Error("Webhook secret not configured");
	}

	const stripeClient = createStripeClient(c.env.STRIPE_SECRET_KEY);

	const event = await stripeClient.webhooks.constructEventAsync(
		body,
		signature,
		c.env.STRIPE_WEBHOOK_SECRET,
	);

	return { event, stripeClient };
}

/**
 * Process webhook event with graceful error handling
 */
async function processWebhookEvent(
	event: Stripe.Event,
	stripeClient: Stripe,
	db: D1Database,
): Promise<{ success: boolean; message: string }> {
	switch (event.type) {
		case "customer.subscription.created":
		case "customer.subscription.updated":
			return await handleSubscriptionEvent(event, stripeClient, db);

		case "customer.subscription.deleted":
			return await handleSubscriptionDeletion(event, db);

		case "checkout.session.completed":
			return await handleCheckoutCompleted(event, db);

		default:
			return {
				success: true,
				message: `Unhandled event type: ${event.type} - acknowledged`,
			};
	}
}

/**
 * Handle subscription creation/update with idempotency
 */
async function handleSubscriptionEvent(
	event: Stripe.Event,
	stripeClient: Stripe,
	db: D1Database,
): Promise<{ success: boolean; message: string }> {
	const subscription = event.data.object as Stripe.Subscription;

	try {
		// Find user with fallback strategy
		const userId = await findUserForSubscription(subscription, db);

		if (!userId) {
			return {
				success: false,
				message: `No user found for subscription ${subscription.id} - event acknowledged`,
			};
		}

		const existing = await db
			.prepare(
				"SELECT stripe_subscription_id, stripe_event_created FROM user_subscriptions WHERE user_id = ?",
			)
			.bind(userId)
			.first();

		if (
			existing?.stripe_subscription_id === subscription.id &&
			event.created <= Number(existing.stripe_event_created || 0)
		) {
			return {
				success: true,
				message: `Stale event for subscription ${subscription.id} ignored`,
			};
		}

		await saveSubscription(db, userId, subscription, stripeClient, event.type, event.created);

		return {
			success: true,
			message: `Subscription ${subscription.id} processed successfully`,
		};
	} catch (error) {
		return {
			success: false,
			message: `Failed to process subscription ${subscription.id}: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Handle subscription deletion with graceful fallback
 */
async function handleSubscriptionDeletion(
	event: Stripe.Event,
	db: D1Database,
): Promise<{ success: boolean; message: string }> {
	const subscription = event.data.object as Stripe.Subscription;

	try {
		const userId = await findUserForSubscription(subscription, db);

		if (!userId) {
			return {
				success: true,
				message: `Deleted subscription ${subscription.id} has no local user`,
			};
		}

		const existing = await db
			.prepare("SELECT stripe_event_created FROM user_subscriptions WHERE user_id = ?")
			.bind(userId)
			.first();

		if (event.created <= Number(existing?.stripe_event_created || 0)) {
			return {
				success: true,
				message: `Stale deletion for subscription ${subscription.id} ignored`,
			};
		}

		await db
			.prepare(`
	      INSERT INTO user_subscriptions
	      (user_id, plan_type, status, stripe_subscription_id, stripe_event_created, updated_at)
	      VALUES (?, 'hobby', 'active', NULL, ?, ?)
	      ON CONFLICT(user_id) DO UPDATE SET
	        plan_type = excluded.plan_type,
	        status = excluded.status,
	        stripe_subscription_id = NULL,
	        cancel_at_period_end = FALSE,
	        price = 0,
	        stripe_price_id = NULL,
	        stripe_event_created = excluded.stripe_event_created,
	        updated_at = excluded.updated_at
	    `)
			.bind(userId, event.created, new Date().toISOString())
			.run();

		return {
			success: true,
			message: `User ${userId} downgraded to hobby plan`,
		};
	} catch (error) {
		return {
			success: false,
			message: `Failed to process subscription deletion ${subscription.id}: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Find user ID for subscription with multiple strategies
 */
async function findUserForSubscription(
	subscription: Stripe.Subscription,
	db: D1Database,
): Promise<string | null> {
	// Strategy 1: Use metadata
	if (subscription.metadata?.userId) {
		return subscription.metadata.userId;
	}

	// Strategy 2: Look up by customer ID
	const existing = await db
		.prepare("SELECT user_id FROM user_subscriptions WHERE stripe_customer_id = ?")
		.bind(subscription.customer)
		.first();

	return (existing?.user_id as string) || null;
}

/**
 * Save subscription with error recovery and fallback
 */
async function saveSubscription(
	db: D1Database,
	userId: string,
	subscription: Stripe.Subscription,
	stripeClient: Stripe,
	eventType: string,
	eventCreated: number,
): Promise<void> {
	const { start: periodStart, end: periodEnd } = extractSubscriptionPeriod(subscription);
	const { price, billingInterval, priceId } = await extractSubscriptionPricing(
		subscription,
		stripeClient,
	);
	const status = mapStripeStatus(subscription.status);

	await db
		.prepare(`
	      INSERT INTO user_subscriptions
	      (user_id, stripe_customer_id, stripe_subscription_id, plan_type, status,
	       current_period_start, current_period_end, cancel_at_period_end,
	       price, billing_interval, stripe_price_id, payment_type, stripe_event_created, updated_at)
	      VALUES (?, ?, ?, 'pro', ?, ?, ?, ?, ?, ?, ?, 'subscription', ?, ?)
	      ON CONFLICT(user_id) DO UPDATE SET
	        stripe_customer_id = excluded.stripe_customer_id,
	        stripe_subscription_id = excluded.stripe_subscription_id,
	        plan_type = excluded.plan_type,
	        status = excluded.status,
	        current_period_start = excluded.current_period_start,
	        current_period_end = excluded.current_period_end,
	        cancel_at_period_end = excluded.cancel_at_period_end,
	        price = excluded.price,
	        billing_interval = excluded.billing_interval,
	        stripe_price_id = excluded.stripe_price_id,
	        payment_type = excluded.payment_type,
	        stripe_event_created = excluded.stripe_event_created,
	        updated_at = excluded.updated_at
	    `)
		.bind(
			userId,
			subscription.customer,
			subscription.id,
			status,
			periodStart,
			periodEnd,
			subscription.cancel_at_period_end || false,
			price,
			billingInterval,
			priceId,
			eventCreated,
			new Date().toISOString(),
		)
		.run();

	if (eventType === "customer.subscription.created") {
		try {
			const userResult = await db
				.prepare("SELECT email FROM users WHERE id = ?")
				.bind(userId)
				.first();

			if (userResult?.email) {
				const telegramMessage = `💳 New Subscription Payment
Email: ${userResult.email}
Plan: Pro Plan
Amount: $${price}
Billing: ${billingInterval}`;

				await notifyTelegram(telegramMessage, "alerts");
			}
		} catch (notificationError) {
			console.warn("Failed to send subscription Telegram notification:", notificationError);
		}
	}
}

/**
 * Handle checkout.session.completed — route to one-time handler if applicable
 */
async function handleCheckoutCompleted(
	event: Stripe.Event,
	db: D1Database,
): Promise<{ success: boolean; message: string }> {
	const session = event.data.object as Stripe.Checkout.Session;

	if (session.mode !== "payment") {
		return {
			success: true,
			message: `Checkout session ${session.id} is mode=${session.mode}, skipping (handled by subscription events)`,
		};
	}

	return await handleOneTimePayment(session, db);
}

/**
 * Handle one-time payment: compute expiration and write to user_subscriptions
 * Extends the existing period if the user already has active time remaining
 */
async function handleOneTimePayment(
	session: Stripe.Checkout.Session,
	db: D1Database,
): Promise<{ success: boolean; message: string }> {
	try {
		const userId = session.metadata?.userId || session.client_reference_id;
		if (!userId) {
			return {
				success: false,
				message: `No user found for checkout session ${session.id}`,
			};
		}

		const priceId = session.metadata?.priceId;
		const durationDays = priceId ? ONETIME_DURATIONS[priceId] : null;

		if (!durationDays) {
			return {
				success: false,
				message: `Unknown one-time priceId "${priceId}" for session ${session.id}`,
			};
		}

		const existing = await db
			.prepare("SELECT current_period_end, payment_type FROM user_subscriptions WHERE user_id = ?")
			.bind(userId)
			.first();

		const now = new Date();
		let periodStart: Date;

		if (
			existing?.payment_type === "one_time" &&
			existing?.current_period_end &&
			new Date(existing.current_period_end as string) > now
		) {
			periodStart = new Date(existing.current_period_end as string);
		} else {
			periodStart = now;
		}

		const periodEnd = new Date(periodStart.getTime() + durationDays * 24 * 60 * 60 * 1000);

		const price = session.amount_total ? session.amount_total / 100 : 0;
		const billingInterval = (priceId && ONETIME_INTERVALS[priceId]) || "month";

		await db
			.prepare(`
					INSERT INTO user_subscriptions
					(user_id, stripe_customer_id, stripe_subscription_id, plan_type, status,
					 current_period_start, current_period_end, cancel_at_period_end,
					 price, billing_interval, stripe_price_id, payment_type, stripe_event_created, updated_at)
					VALUES (?, ?, NULL, 'pro', 'active', ?, ?, FALSE, ?, ?, ?, 'one_time', 0, ?)
					ON CONFLICT(user_id) DO UPDATE SET
					  stripe_customer_id = excluded.stripe_customer_id,
					  stripe_subscription_id = NULL,
					  plan_type = excluded.plan_type,
					  status = excluded.status,
					  current_period_start = excluded.current_period_start,
					  current_period_end = excluded.current_period_end,
					  cancel_at_period_end = excluded.cancel_at_period_end,
					  price = excluded.price,
					  billing_interval = excluded.billing_interval,
					  stripe_price_id = excluded.stripe_price_id,
					  payment_type = excluded.payment_type,
					  stripe_event_created = 0,
					  updated_at = excluded.updated_at
				`)
			.bind(
				userId,
				session.customer || null,
				now.toISOString(),
				periodEnd.toISOString(),
				price,
				billingInterval,
				priceId,
				new Date().toISOString(),
			)
			.run();

		try {
			const userResult = await db
				.prepare("SELECT email FROM users WHERE id = ?")
				.bind(userId)
				.first();

			if (userResult?.email) {
				const currencySymbol = session.currency?.toUpperCase() === "CNY" ? "¥" : "$";
				const telegramMessage = `💳 New One-time Payment\nEmail: ${userResult.email}\nPlan: Pro Pass\nAmount: ${currencySymbol}${price}\nDuration: ${durationDays} days\nExpires: ${periodEnd.toISOString().split("T")[0]}`;
				await notifyTelegram(telegramMessage, "alerts");
			}
		} catch (_notificationError) {
			console.warn("Failed to send one-time payment Telegram notification");
		}

		return {
			success: true,
			message: `One-time payment processed: user ${userId} has Pro access until ${periodEnd.toISOString()}`,
		};
	} catch (error) {
		return {
			success: false,
			message: `Failed to process one-time payment for session ${session.id}: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Map Stripe status to internal status with fallback
 */
export function mapStripeStatus(stripeStatus: string): string {
	const statusMap: Record<string, string> = {
		active: "active",
		canceled: "canceled",
		past_due: "past_due",
		trialing: "active",
		incomplete: "inactive",
		incomplete_expired: "inactive",
		unpaid: "past_due",
		paused: "canceled",
	};

	return statusMap[stripeStatus] || "inactive";
}

export default stripe;
