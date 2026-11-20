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
import { effectivePlanType } from "../utils/subscription";
import { recordSubscriptionReceipt } from "../utils/subscription-receipts";
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
				"SELECT payment_type, status, current_period_end, plan_type,stripe_subscription_id,stripe_customer_id FROM user_subscriptions WHERE user_id = ?",
			)
				.bind(user.id)
				.first();

			if (existing) {
				const hasActiveSubscription =
					existing.payment_type === "subscription" && !!existing.stripe_subscription_id;
				const hasActiveOneTime =
					existing.payment_type === "one_time" &&
					existing.current_period_end &&
					new Date(existing.current_period_end as string) > new Date();

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
			const back = new URL(cancelUrl || "/#pricing", origin);
			const finalCancelUrl = back.origin === origin ? back.href : origin + "/#pricing";

			const stripeClient = createStripeClient(c.env.STRIPE_SECRET_KEY);

			const sessionParams: Stripe.Checkout.SessionCreateParams = {
				line_items: [{ price: priceIdValue, quantity: 1 }],
				mode: isOneTime ? "payment" : "subscription",
				success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
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
					400,
				);

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

// A single durable attempt binds concurrent checkout requests to one Stripe session.
async function checkoutSession(
	db: D1Database,
	client: Stripe,
	userId: string,
	priceId: string,
	params: Stripe.Checkout.SessionCreateParams,
) {
	type Attempt = {
		attempt_id: string;
		price_id: string;
		expires_at: number;
		session_id: string | null;
		parameters: string;
	};
	for (let retry = 0; retry < 3; retry++) {
		const id = crypto.randomUUID(),
			expires = Math.floor(Date.now() / 1000) + 3600;
		await db
			.prepare(
				"INSERT INTO checkout_attempts(user_id,attempt_id,price_id,expires_at,parameters) SELECT ?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM user_subscriptions WHERE user_id=? AND ((stripe_subscription_id IS NOT NULL) OR (?='subscription' AND payment_type='one_time' AND julianday(current_period_end)>julianday('now')))) ON CONFLICT(user_id) DO NOTHING",
			)
			.bind(userId, id, priceId, expires, JSON.stringify(params), userId, params.mode)
			.run();
		const attempt = await db
			.prepare("SELECT * FROM checkout_attempts WHERE user_id=?")
			.bind(userId)
			.first<Attempt>();
		if (!attempt) return null;
		let session: Stripe.Checkout.Session | undefined;
		if (attempt.session_id) session = await client.checkout.sessions.retrieve(attempt.session_id);
		else {
			if (attempt.expires_at <= Math.floor(Date.now() / 1000)) {
				// If creation was acknowledged only by Stripe, recover the session before opening another checkout.
				for await (const candidate of client.checkout.sessions.list({
					created: { gte: attempt.expires_at - 3601, lte: attempt.expires_at },
					limit: 100,
				})) {
					if (candidate.metadata?.attempt === attempt.attempt_id) {
						session = candidate;
						break;
					}
				}
				if (!session) {
					await db
						.prepare("DELETE FROM checkout_attempts WHERE attempt_id=?")
						.bind(attempt.attempt_id)
						.run();
					continue;
				}
			} else {
				const stored = JSON.parse(attempt.parameters) as Stripe.Checkout.SessionCreateParams;
				stored.expires_at = attempt.expires_at;
				stored.metadata = { ...stored.metadata, attempt: attempt.attempt_id };
				if (stored.subscription_data)
					stored.subscription_data.metadata = {
						...stored.subscription_data.metadata,
						attempt: attempt.attempt_id,
					};
				try {
					session = await client.checkout.sessions.create(stored, {
						idempotencyKey: attempt.attempt_id,
					});
				} catch (error) {
					if (error instanceof Error && "param" in error && error.param === "expires_at")
						return null;
					throw error;
				}
			}
			const attached = await db
				.prepare(
					"UPDATE checkout_attempts SET session_id=? WHERE attempt_id=? RETURNING attempt_id",
				)
				.bind(session.id, attempt.attempt_id)
				.first();
			if (!attached) return null;
		}
		if (session.status === "complete") return null;
		if (session.status === "open" && attempt.price_id === priceId) return session;
		if (session.status === "open") await client.checkout.sessions.expire(session.id);
		await db
			.prepare("DELETE FROM checkout_attempts WHERE attempt_id=?")
			.bind(attempt.attempt_id)
			.run();
	}
	return null;
}

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

		const quota =
			OAUTH_SUBSCRIPTION_QUOTAS[effectivePlanType(result)] || OAUTH_SUBSCRIPTION_QUOTAS.hobby;
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
				currency: result?.currency ? String(result.currency) : null,
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
		case "invoice.paid":
			await recordSubscriptionReceipt(db, event.data.object as Stripe.Invoice);
			return { success: true, message: "Subscription receipt recorded" };
		case "customer.subscription.created":
		case "customer.subscription.updated":
			return await handleSubscriptionEvent(event, stripeClient, db);

		case "customer.subscription.deleted":
			return await handleSubscriptionDeletion(event, db);

		case "checkout.session.completed":
		case "checkout.session.async_payment_succeeded":
			return await handleCheckoutCompleted(event, db);
		case "checkout.session.expired":
		case "checkout.session.async_payment_failed": {
			const checkout = event.data.object as Stripe.Checkout.Session;
			await db
				.prepare("DELETE FROM checkout_attempts WHERE attempt_id=?")
				.bind(checkout.metadata?.attempt ?? "")
				.run();
			return { success: true, message: "Checkout closed" };
		}

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

		const previous = await db
			.prepare("SELECT billing_revision FROM user_subscriptions WHERE user_id=?")
			.bind(userId)
			.first();
		const current = await stripeClient.subscriptions.retrieve(subscription.id);
		if (current.status === "canceled" || current.status === "incomplete_expired")
			return handleSubscriptionDeletion(event, db);
		await saveSubscription(
			db,
			userId,
			current,
			event.type,
			event.created,
			Number(previous?.billing_revision ?? -1),
		);

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
		await db.batch([
			db
				.prepare("INSERT OR IGNORE INTO ended_subscriptions(subscription_id) VALUES(?)")
				.bind(subscription.id),
			db
				.prepare(
					"UPDATE user_subscriptions SET plan_type='hobby',status='active',stripe_subscription_id=NULL,cancel_at_period_end=0,price=0,stripe_price_id=NULL,currency=NULL,billing_revision=billing_revision+1,stripe_event_created=?,updated_at=? WHERE stripe_subscription_id=?",
				)
				.bind(event.created, new Date().toISOString(), subscription.id),
		]);

		return {
			success: true,
			message: `Processed end of subscription ${subscription.id}`,
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

	eventType: string,
	eventCreated: number,
	previousRevision: number,
): Promise<void> {
	const { start: periodStart, end: periodEnd } = extractSubscriptionPeriod(subscription);
	const item = subscription.items.data[0]?.price;
	if (!item) throw Error("Subscription pricing missing");
	const price = (item.unit_amount ?? 0) / 100,
		priceId = item.id,
		billingInterval = formatBillingInterval(
			item.recurring?.interval ?? "month",
			item.recurring?.interval_count ?? 1,
		);
	const status = mapStripeStatus(subscription.status);

	const saved = await db
		.prepare(`
	      INSERT INTO user_subscriptions
	      (user_id, stripe_customer_id, stripe_subscription_id, plan_type, status,
	       current_period_start, current_period_end, cancel_at_period_end,
	       price, billing_interval, stripe_price_id, payment_type, stripe_event_created, updated_at,currency)
          SELECT ?, ?, ?, 'pro', ?, ?, ?, ?, ?, ?, ?, 'subscription', ?, ?, ? WHERE NOT EXISTS(SELECT 1 FROM ended_subscriptions WHERE subscription_id=?)
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
	        updated_at = excluded.updated_at,currency=excluded.currency,billing_revision=billing_revision+1
            WHERE billing_revision=? AND (payment_type!='one_time' OR coalesce(julianday(current_period_end),0)<=julianday('now')) AND (user_subscriptions.stripe_subscription_id IS NULL OR user_subscriptions.stripe_subscription_id=excluded.stripe_subscription_id)
            RETURNING user_id
        `)
		.bind(
			userId,
			subscription.customer,
			subscription.id,
			status,
			periodStart,
			periodEnd,
			Number(subscription.cancel_at_period_end),
			price,
			billingInterval,
			priceId,
			eventCreated,
			new Date().toISOString(),
			item.currency.toUpperCase(),
			subscription.id,
			previousRevision,
		)
		.first();
	if (!saved) {
		if (
			await db
				.prepare("SELECT 1 FROM ended_subscriptions WHERE subscription_id=?")
				.bind(subscription.id)
				.first()
		)
			return;
		throw Error("Subscription state changed during reconciliation");
	}
	await db
		.prepare("DELETE FROM checkout_attempts WHERE user_id=? AND attempt_id=?")
		.bind(userId, subscription.metadata?.attempt ?? "")
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
Amount: ${item.currency.toUpperCase()} ${price}
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

	if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required")
		return { success: true, message: "Waiting for payment confirmation" };
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

		const price = (session.amount_total ?? 0) / 100;
		const currency = session.currency?.toUpperCase();
		if (!currency) throw Error("Missing payment currency");
		const now = new Date().toISOString();
		const receipt = db
			.prepare("INSERT INTO fulfilled_passes(session_id,user_id,fulfilled_at) VALUES(?,?,?)")
			.bind(session.id, userId, now);
		const grant = db
			.prepare(`INSERT INTO user_subscriptions(user_id,stripe_customer_id,stripe_subscription_id,plan_type,status,current_period_start,current_period_end,cancel_at_period_end,price,billing_interval,stripe_price_id,payment_type,stripe_event_created,updated_at,currency)
 VALUES(?,?,NULL,'pro','active',?,strftime('%Y-%m-%dT%H:%M:%fZ',?,?),0,?,?,?,'one_time',0,?,?)
 ON CONFLICT(user_id) DO UPDATE SET stripe_customer_id=coalesce(excluded.stripe_customer_id,user_subscriptions.stripe_customer_id),plan_type='pro',status='active',current_period_start=excluded.current_period_start,
 current_period_end=strftime('%Y-%m-%dT%H:%M:%fZ',max(julianday(excluded.current_period_start),CASE WHEN payment_type='one_time' THEN coalesce(julianday(current_period_end),0) ELSE 0 END),?),
 price=excluded.price,billing_interval=excluded.billing_interval,stripe_price_id=excluded.stripe_price_id,payment_type='one_time',billing_revision=billing_revision+1,updated_at=excluded.updated_at,currency=excluded.currency
 WHERE user_subscriptions.stripe_subscription_id IS NULL RETURNING current_period_end`)
			.bind(
				userId,
				session.customer || null,
				now,
				now,
				"+" + durationDays + " days",
				price,
				ONETIME_INTERVALS[priceId!],
				priceId,
				now,
				currency,
				"+" + durationDays + " days",
			);
		let expires: string;
		try {
			const results = await db.batch([
				receipt,
				grant,
				db
					.prepare("DELETE FROM checkout_attempts WHERE attempt_id=?")
					.bind(session.metadata?.attempt ?? ""),
			]);
			expires = String(
				(results[1].results[0] as { current_period_end: string } | undefined)?.current_period_end ??
					"",
			);
			if (!expires) throw Error("Existing recurring entitlement conflicts with paid pass");
		} catch (error) {
			if (
				await db
					.prepare("SELECT 1 FROM fulfilled_passes WHERE session_id=?")
					.bind(session.id)
					.first()
			)
				return { success: true, message: "Pass already fulfilled" };
			throw error;
		}

		try {
			const userResult = await db
				.prepare("SELECT email FROM users WHERE id = ?")
				.bind(userId)
				.first();

			if (userResult?.email) {
				const telegramMessage = `💳 New One-time Payment\nEmail: ${userResult.email}\nPlan: Pro Pass\nAmount: ${currency} ${price}\nDuration: ${durationDays} days\nExpires: ${expires.split("T")[0]}`;
				await notifyTelegram(telegramMessage, "alerts");
			}
		} catch (_notificationError) {
			console.warn("Failed to send one-time payment Telegram notification");
		}

		return {
			success: true,
			message: `One-time payment processed: user ${userId} has Pro access until ${expires}`,
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
