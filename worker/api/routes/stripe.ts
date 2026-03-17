import { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import Stripe from "stripe";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth";
import type { AppEnv } from "../types/hono";
import { logger } from "../utils/logger.js";
import { notifyTelegram } from "../utils/telegram-notifier";

const stripe = new OpenAPIHono<AppEnv>();

/**
 * Extract period information from Stripe subscription object
 * Uses the first subscription item's period data
 */
function extractSubscriptionPeriod(subscription: Stripe.Subscription) {
	const firstItem = subscription.items?.data?.[0];
	if (!firstItem) {
		console.warn("🔔 [STRIPE] No subscription items found", {
			subscriptionId: subscription.id,
		});
		return { start: null, end: null };
	}

	const periodStart = firstItem.current_period_start
		? new Date(firstItem.current_period_start * 1000).toISOString()
		: null;

	const periodEnd = firstItem.current_period_end
		? new Date(firstItem.current_period_end * 1000).toISOString()
		: null;

	console.log("🔔 [STRIPE] Extracted period data", {
		subscriptionId: subscription.id,
		periodStart,
		periodEnd,
		rawStart: firstItem.current_period_start,
		rawEnd: firstItem.current_period_end,
	});

	return { start: periodStart, end: periodEnd };
}

/**
 * Extract subscription pricing information from Stripe subscription
 */
async function extractSubscriptionPricing(subscription: Stripe.Subscription, stripeClient: Stripe) {
	const firstItem = subscription.items?.data?.[0];
	if (!firstItem) {
		console.warn("🔔 [STRIPE] No subscription items found", {
			subscriptionId: subscription.id,
		});
		return { price: 0, billingInterval: "month", priceId: null };
	}

	try {
		// Get the price object from Stripe to get accurate pricing info
		const priceObject = await stripeClient.prices.retrieve(firstItem.price.id);

		const price = priceObject.unit_amount ? priceObject.unit_amount / 100 : 0;

		// Handle billing interval with interval_count for complex periods
		const interval = priceObject.recurring?.interval || "month";
		const intervalCount = priceObject.recurring?.interval_count || 1;

		let billingInterval: string;
		if (interval === "month" && intervalCount === 6) {
			billingInterval = "6 months";
		} else if (intervalCount === 1) {
			billingInterval = interval;
		} else {
			billingInterval = `${intervalCount} ${interval}${intervalCount > 1 ? "s" : ""}`;
		}

		logger.info(
			`🔔 [STRIPE] Extracted pricing info for subscription ${subscription.id}: ${price} ${billingInterval}`,
		);

		return {
			price,
			billingInterval,
			priceId: priceObject.id,
		};
	} catch (error) {
		await logger.error(
			`🔔 [STRIPE] Error fetching price details for ${firstItem.price.id}: ${error instanceof Error ? error.message : "Unknown error"}`,
		);

		// Fallback to basic price info from subscription item
		const price = firstItem.price.unit_amount ? firstItem.price.unit_amount / 100 : 0;
		const interval = firstItem.price.recurring?.interval || "month";
		const intervalCount = firstItem.price.recurring?.interval_count || 1;

		let billingInterval: string;
		if (interval === "month" && intervalCount === 6) {
			billingInterval = "6 months";
		} else if (intervalCount === 1) {
			billingInterval = interval;
		} else {
			billingInterval = `${intervalCount} ${interval}${intervalCount > 1 ? "s" : ""}`;
		}

		return {
			price,
			billingInterval,
			priceId: firstItem.price.id,
		};
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

const ONETIME_DURATIONS: Record<string, number> = {
	onetime_weekly: 7,
	onetime_monthly: 30,
	onetime_semiannual: 180,
	onetime_annual: 365,
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
						schema: z.object({ url: z.string() }),
					},
				},
			},
			400: {
				description: "Bad request - invalid price ID",
				content: {
					"application/json": {
						schema: z.object({ error: z.string() }),
					},
				},
			},
			500: {
				description: "Internal server error",
				content: {
					"application/json": {
						schema: z.object({
							error: z.string(),
							details: z.string().optional(),
						}),
					},
				},
			},
		},
	},
	async (c): Promise<any> => {
		try {
			const { priceId, cancelUrl } = await c.req.json();
			const user = c.get("user");

			if (!c.env.STRIPE_SECRET_KEY) {
				return c.json({ error: "Stripe configuration error" }, 500);
			}

			const priceIdValue = PRICES[priceId as keyof typeof PRICES](c.env);
			if (!priceIdValue) {
				return c.json({ error: "Invalid price ID" }, 400);
			}

			const finalCancelUrl = cancelUrl || `${c.env.FRONTEND_URL}/#pricing`;
			const isOneTime = priceId.startsWith("onetime_");

			const stripeClient = new Stripe(c.env.STRIPE_SECRET_KEY, {
				apiVersion: "2025-07-30.basil",
			});

			const sessionParams: Stripe.Checkout.SessionCreateParams = {
				line_items: [{ price: priceIdValue, quantity: 1 }],
				mode: isOneTime ? "payment" : "subscription",
				success_url: `${c.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
				cancel_url: finalCancelUrl,
				client_reference_id: user.id,
				customer_email: user.email,
				metadata: {
					userId: user.id,
					planType: "pro",
					paymentType: isOneTime ? "one_time" : "subscription",
					priceId,
				},
				allow_promotion_codes: true,
				billing_address_collection: "auto",
			};

			if (!isOneTime) {
				sessionParams.subscription_data = {
					metadata: { userId: user.id, planType: "pro" },
				};
			}

			const session = await stripeClient.checkout.sessions.create(sessionParams);

			return c.json({ url: session.url! });
		} catch (error) {
			return c.json(
				{
					error: "Failed to create checkout session",
					details: error instanceof Error ? error.message : "Unknown error",
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
							url: z.string(),
						}),
					},
				},
			},
			401: {
				description: "Unauthorized",
				content: {
					"application/json": {
						schema: z.object({
							error: z.string(),
						}),
					},
				},
			},
			404: {
				description: "No subscription found",
				content: {
					"application/json": {
						schema: z.object({
							error: z.string(),
						}),
					},
				},
			},
			500: {
				description: "Internal server error",
				content: {
					"application/json": {
						schema: z.object({
							error: z.string(),
						}),
					},
				},
			},
		},
	},
	async (c): Promise<any> => {
		const user = c.get("user");
		if (!user) {
			return c.json({ error: "Unauthorized" }, 401);
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
				return c.json({ error: "No billing information found" }, 404);
			}

			// Create Stripe client
			const stripeClient = new Stripe(c.env.STRIPE_SECRET_KEY, {
				apiVersion: "2025-07-30.basil",
			});

			// Create billing portal session with return URL that triggers refresh
			const session = await stripeClient.billingPortal.sessions.create({
				customer: result.stripe_customer_id as string,
				return_url: `${c.env.FRONTEND_URL}/billing?refresh=true`,
			});

			return c.json({ url: session.url });
		} catch (error) {
			console.error("Failed to create billing portal session:", error);
			return c.json({ error: "Failed to create billing portal session" }, 500);
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

		// Plan configuration for quotas and names only
		const PLAN_CONFIG: Record<
			string,
			{
				name: string;
				weekly_quota: number;
				minute_quota: number;
			}
		> = {
			hobby: {
				name: "Hobby",
				weekly_quota: 10,
				minute_quota: 1,
			},
			pro: {
				name: "Pro",
				weekly_quota: 10000,
				minute_quota: 20,
			},
			enterprise: {
				name: "Enterprise",
				weekly_quota: -1,
				minute_quota: -1,
			},
		};

		let planType = (result?.plan_type as keyof typeof PLAN_CONFIG) || "hobby";
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

		const planConfig = PLAN_CONFIG[planType];
		const price = result?.price ?? 0;
		const billingInterval = result?.billing_interval ?? "month";

		return c.json({
			id: result?.stripe_subscription_id || `mock_${user.id}`,
			plan_id: planType,
			plan_name: planConfig.name,
			status,
			current_period_start: result?.current_period_start,
			current_period_end: result?.current_period_end,
			cancel_at_period_end: Boolean(result?.cancel_at_period_end),
			weekly_quota: planConfig.weekly_quota,
			minute_quota: planConfig.minute_quota,
			price: price,
			billing_interval: billingInterval,
			payment_type: paymentType,
			stripe_customer_id: result?.stripe_customer_id,
		});
	},
);

/**
 * Modern idempotent webhook handler with graceful error handling
 * Always returns 2xx status codes as required by Stripe
 */
stripe.post("/webhook", async (c) => {
	const eventId = c.req.header("stripe-signature")?.split(",")[0]?.split("=")[1] || "unknown";

	try {
		// Validate and parse webhook
		const { event, stripeClient } = await validateWebhook(c);

		logger.info(`🔔 [STRIPE WEBHOOK] Processing event ${event.type} (${event.id})`);

		// Process event with graceful error handling
		const result = await processWebhookEvent(event, stripeClient, c.env.DB);

		logger.info(
			`🔔 [STRIPE WEBHOOK] Event ${event.type} (${event.id}) processed: ${result.success ? "success" : "handled_gracefully"} - ${result.message}`,
		);

		// Always return 200 for Stripe
		return c.json({
			received: true,
			eventId: event.id,
			processed: result.success,
			message: result.message,
		});
	} catch (error) {
		// Log error but still return 200 to prevent Stripe retries
		await logger.error(
			`🔔 [STRIPE WEBHOOK] Critical error for event ${eventId}: ${error instanceof Error ? error.message : String(error)}`,
		);

		// Return 200 with error details for monitoring
		return c.json({
			received: true,
			eventId,
			processed: false,
			error: "Critical processing error - logged for investigation",
		});
	}
});

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

	const stripeClient = new Stripe(c.env.STRIPE_SECRET_KEY, {
		apiVersion: "2025-07-30.basil",
	});

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

		// Check for idempotency (prevent duplicate processing)
		const existing = await db
			.prepare(
				"SELECT stripe_subscription_id, updated_at FROM user_subscriptions WHERE user_id = ?",
			)
			.bind(userId)
			.first();

		if (existing?.stripe_subscription_id === subscription.id) {
			const lastUpdate = new Date(existing.updated_at as string);
			const eventTime = new Date(event.created * 1000);

			if (eventTime <= lastUpdate) {
				return {
					success: true,
					message: `Duplicate event for subscription ${subscription.id} - ignored`,
				};
			}
		}

		// Save subscription with error recovery
		await saveSubscriptionSafely(db, userId, subscription, stripeClient, event.type);

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
				success: false,
				message: `No user found for deleted subscription ${subscription.id} - event acknowledged`,
			};
		}

		// Downgrade to hobby plan
		await db
			.prepare(`
      INSERT OR REPLACE INTO user_subscriptions
      (user_id, plan_type, status, stripe_subscription_id, updated_at)
      VALUES (?, 'hobby', 'active', NULL, ?)
    `)
			.bind(userId, new Date().toISOString())
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
async function saveSubscriptionSafely(
	db: D1Database,
	userId: string,
	subscription: Stripe.Subscription,
	stripeClient: Stripe,
	eventType: string,
): Promise<void> {
	try {
		// Extract data with fallbacks
		const { start: periodStart, end: periodEnd } = extractSubscriptionPeriod(subscription);
		const { price, billingInterval, priceId } = await extractSubscriptionPricing(
			subscription,
			stripeClient,
		);

		// Map status with fallback
		const status = mapStripeStatus(subscription.status);

		// Atomic database operation
		await db
			.prepare(`
      INSERT OR REPLACE INTO user_subscriptions
      (user_id, stripe_customer_id, stripe_subscription_id, plan_type, status,
       current_period_start, current_period_end, cancel_at_period_end,
       price, billing_interval, stripe_price_id, payment_type, updated_at)
      VALUES (?, ?, ?, 'pro', ?, ?, ?, ?, ?, ?, ?, 'subscription', ?)
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
				new Date().toISOString(),
			)
			.run();

		// Send Telegram notification only for new subscription creation
		if (eventType === "customer.subscription.created") {
			try {
				// Get user email for notification
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
				// Don't fail the subscription save if notification fails
				console.warn("Failed to send subscription Telegram notification:", notificationError);
			}
		}
	} catch (error) {
		// If detailed save fails, save minimal data to prevent total loss
		await db
			.prepare(`
      INSERT OR REPLACE INTO user_subscriptions
      (user_id, stripe_customer_id, stripe_subscription_id, plan_type, status, payment_type, updated_at)
      VALUES (?, ?, ?, 'pro', 'active', 'subscription', ?)
    `)
			.bind(userId, subscription.customer, subscription.id, new Date().toISOString())
			.run();

		throw new Error(
			`Partial save completed due to: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
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
		const billingInterval = priceId?.replace("onetime_", "") || "unknown";

		await db
			.prepare(`
				INSERT OR REPLACE INTO user_subscriptions
				(user_id, stripe_customer_id, stripe_subscription_id, plan_type, status,
				 current_period_start, current_period_end, cancel_at_period_end,
				 price, billing_interval, stripe_price_id, payment_type, updated_at)
				VALUES (?, ?, NULL, 'pro', 'active', ?, ?, FALSE, ?, ?, ?, 'one_time', ?)
			`)
			.bind(
				userId,
				session.customer || null,
				now.toISOString(),
				periodEnd.toISOString(),
				price,
				billingInterval,
				null,
				new Date().toISOString(),
			)
			.run();

		try {
			const userResult = await db
				.prepare("SELECT email FROM users WHERE id = ?")
				.bind(userId)
				.first();

			if (userResult?.email) {
				const telegramMessage = `💳 New One-time Payment\nEmail: ${userResult.email}\nPlan: Pro Pass\nAmount: $${price}\nDuration: ${durationDays} days\nExpires: ${periodEnd.toISOString().split("T")[0]}`;
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
function mapStripeStatus(stripeStatus: string): string {
	const statusMap: Record<string, string> = {
		active: "active",
		canceled: "cancelled",
		past_due: "past_due",
		trialing: "active",
		incomplete: "inactive",
		incomplete_expired: "inactive",
		unpaid: "past_due",
		paused: "cancelled",
	};

	return statusMap[stripeStatus] || "inactive";
}

export default stripe;
