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
} as const;

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
							priceId: z.enum(["weekly", "monthly", "semiannual", "annual"]),
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

			// Validate environment variables
			if (!c.env.STRIPE_SECRET_KEY) {
				return c.json({ error: "Stripe configuration error" }, 500);
			}

			// Get the price ID from environment
			const priceIdValue = PRICES[priceId as keyof typeof PRICES](c.env);
			if (!priceIdValue) {
				return c.json({ error: "Invalid price ID" }, 400);
			}

			// Use frontend provided cancelUrl, fallback to pricing
			const finalCancelUrl = cancelUrl || `${c.env.FRONTEND_URL}/#pricing`;

			const stripeClient = new Stripe(c.env.STRIPE_SECRET_KEY, {
				apiVersion: "2025-07-30.basil",
			});

			const session = await stripeClient.checkout.sessions.create({
				line_items: [{ price: priceIdValue, quantity: 1 }],
				mode: "subscription",
				success_url: `${c.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
				cancel_url: finalCancelUrl,
				client_reference_id: user.id,
				customer_email: user.email,
				metadata: { userId: user.id, planType: "pro" },
				subscription_data: {
					metadata: { userId: user.id, planType: "pro" },
				},
				allow_promotion_codes: true,
				billing_address_collection: "auto",
			});

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

		const planType = (result?.plan_type as keyof typeof PLAN_CONFIG) || "hobby";
		const planConfig = PLAN_CONFIG[planType];

		// Use actual subscription data from database
		const price = result?.price ?? 0;
		const billingInterval = result?.billing_interval ?? "month";

		return c.json({
			id: result?.stripe_subscription_id || `mock_${user.id}`,
			plan_id: planType,
			plan_name: planConfig.name,
			status: result?.status || "active",
			current_period_start: result?.current_period_start,
			current_period_end: result?.current_period_end,
			cancel_at_period_end: Boolean(result?.cancel_at_period_end),
			weekly_quota: planConfig.weekly_quota,
			minute_quota: planConfig.minute_quota,
			price: price,
			billing_interval: billingInterval,
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
       price, billing_interval, stripe_price_id, updated_at)
      VALUES (?, ?, ?, 'pro', ?, ?, ?, ?, ?, ?, ?, ?)
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
      (user_id, stripe_customer_id, stripe_subscription_id, plan_type, status, updated_at)
      VALUES (?, ?, ?, 'pro', 'active', ?)
    `)
			.bind(userId, subscription.customer, subscription.id, new Date().toISOString())
			.run();

		throw new Error(
			`Partial save completed due to: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
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
