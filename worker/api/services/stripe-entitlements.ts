import type Stripe from "stripe";
import { notifyTelegram } from "../utils/telegram-notifier";

function formatBillingInterval(interval: string, intervalCount: number): string {
	if (interval === "month" && intervalCount === 6) return "6 months";
	if (intervalCount === 1) return interval;
	return `${intervalCount} ${interval}${intervalCount > 1 ? "s" : ""}`;
}

export async function endSubscription(
	db: D1Database,
	id: string,
	created: number,
	attempt?: string,
) {
	await db.batch([
		db.prepare("INSERT OR IGNORE INTO ended_subscriptions(subscription_id) VALUES(?)").bind(id),
		db
			.prepare(`UPDATE user_subscriptions SET plan_type='hobby', status='active',stripe_subscription_id=NULL,
 cancel_at_period_end=0,price=0,stripe_price_id=NULL,currency=NULL,billing_revision=billing_revision+1,
 stripe_event_created=?,updated_at=? WHERE stripe_subscription_id=?`)
			.bind(created, new Date().toISOString(), id),
		db.prepare("DELETE FROM checkout_attempts WHERE attempt_id=?").bind(attempt ?? ""),
	]);
}

export async function reconcileSubscription(
	db: D1Database,
	client: Stripe,
	userId: string,
	id: string,
	eventCreated: number,
) {
	const previous = await db
		.prepare(
			"SELECT billing_revision,stripe_subscription_id,status FROM user_subscriptions WHERE user_id=?",
		)
		.bind(userId)
		.first<{ billing_revision: number; stripe_subscription_id: string | null; status: string }>();
	const subscription = await client.subscriptions.retrieve(id);
	if (subscription.metadata?.userId && subscription.metadata.userId !== userId)
		throw Error("Checkout and subscription owners disagree");
	if (subscription.status === "canceled" || subscription.status === "incomplete_expired")
		return endSubscription(db, id, eventCreated, subscription.metadata?.attempt);
	const first = subscription.items.data[0];
	const item = first?.price;
	if (!item) throw Error("Subscription pricing missing");
	const periodStart = first.current_period_start
		? new Date(first.current_period_start * 1000).toISOString()
		: null;
	const periodEnd = first.current_period_end
		? new Date(first.current_period_end * 1000).toISOString()
		: null;
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
			typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
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
			previous?.billing_revision ?? -1,
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
	if (
		status === "active" &&
		(previous?.stripe_subscription_id !== id || previous.status === "inactive")
	) {
		try {
			const userResult = await db
				.prepare("SELECT email FROM users WHERE id = ?")
				.bind(userId)
				.first();

			if (userResult?.email) {
				const telegramMessage = `💳 Subscription activated
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

const passes: Record<string, { days: number; interval: string }> = {
	onetime_weekly: { days: 7, interval: "week" },
	onetime_monthly: { days: 30, interval: "month" },
	onetime_semiannual: { days: 180, interval: "6 months" },
	onetime_annual: { days: 365, interval: "year" },
};
export async function fulfillPass(db: D1Database, session: Stripe.Checkout.Session) {
	if (session.mode !== "payment") throw Error("Expected a one-time Checkout");
	if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required")
		return "Waiting for payment confirmation";
	const userId = session.metadata?.userId || session.client_reference_id;
	if (!userId || (session.client_reference_id && session.client_reference_id !== userId))
		throw Error("Invalid pass owner");
	const priceId = session.metadata?.priceId ?? "";
	const pass = Object.hasOwn(passes, priceId) ? passes[priceId] : undefined;
	if (!pass) throw Error("Unknown pass duration");
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
			typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null),
			now,
			now,
			"+" + pass.days + " days",
			price,
			pass.interval,
			priceId,
			now,
			currency,
			"+" + pass.days + " days",
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
	} catch (error) {
		if (
			await db.prepare("SELECT 1 FROM fulfilled_passes WHERE session_id=?").bind(session.id).first()
		)
			return "Pass already fulfilled";
		throw error;
	}
	if (!expires) {
		await db.prepare("DELETE FROM fulfilled_passes WHERE session_id=?").bind(session.id).run();
		throw Error("Existing recurring entitlement conflicts with paid pass");
	}

	try {
		const userResult = await db
			.prepare("SELECT email FROM users WHERE id = ?")
			.bind(userId)
			.first();

		if (userResult?.email) {
			const telegramMessage = `💳 New One-time Payment\nEmail: ${userResult.email}\nPlan: Pro Pass\nAmount: ${currency} ${price}\nDuration: ${pass.days} days\nExpires: ${expires.split("T")[0]}`;
			await notifyTelegram(telegramMessage, "alerts");
		}
	} catch (_notificationError) {
		console.warn("Failed to send one-time payment Telegram notification");
	}

	return "Pass fulfilled";
}
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
