import type Stripe from "stripe";
import type { Env } from "../../shared/types";
import { createStripeClient } from "../utils/stripe-client";
import { fulfillPass, reconcileSubscription } from "./stripe-entitlements";

type PendingCheckout = {
	attempt_id: string;
	user_id: string;
	session_id: string | null;
	expires_at: number;
};

export async function reconcileCheckouts(
	env: Pick<Env, "DB" | "STRIPE_SECRET_KEY">,
	scheduledTime: number,
) {
	const now = Math.floor(scheduledTime / 1000);
	// Claim a bounded batch. An interrupted run becomes eligible again the following hour.
	const { results } = await env.DB.prepare(`UPDATE checkout_attempts SET check_after=?
 WHERE attempt_id IN (SELECT attempt_id FROM checkout_attempts
 WHERE ((session_id IS NOT NULL AND expires_at<=?) OR expires_at<=?) AND check_after<=?
 ORDER BY check_after,expires_at,attempt_id LIMIT 12)
 RETURNING attempt_id,user_id,session_id,expires_at`)
		.bind(now + 3600, now + 3300, now, now)
		.all<PendingCheckout>();
	if (!results.length) return;
	if (!/^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY ?? ""))
		throw Error("Live Stripe checkout recovery is not configured");
	const client = createStripeClient(env.STRIPE_SECRET_KEY);
	const failures: unknown[] = [];
	for (const attempt of results) {
		try {
			const session = attempt.session_id
				? await client.checkout.sessions.retrieve(attempt.session_id, {
						expand: ["payment_intent"],
					})
				: await findUnacknowledgedSession(client, attempt);
			if (!session) {
				await env.DB.prepare(
					"DELETE FROM checkout_attempts WHERE attempt_id=? AND session_id IS NULL",
				)
					.bind(attempt.attempt_id)
					.run();
				continue;
			}
			if (
				!session.livemode ||
				session.metadata?.attempt !== attempt.attempt_id ||
				session.client_reference_id !== attempt.user_id ||
				session.metadata.userId !== attempt.user_id
			)
				throw Error("Checkout ownership could not be verified");
			if (!attempt.session_id)
				await env.DB.prepare(
					"UPDATE checkout_attempts SET session_id=? WHERE attempt_id=? AND session_id IS NULL",
				)
					.bind(session.id, attempt.attempt_id)
					.run();
			if (session.status === "open") continue;
			const intent = typeof session.payment_intent === "object" ? session.payment_intent : null;
			if (
				session.status === "expired" ||
				(session.status === "complete" &&
					session.payment_status === "unpaid" &&
					(intent?.status === "canceled" ||
						(intent?.status === "requires_payment_method" && intent.last_payment_error)))
			) {
				await env.DB.prepare("DELETE FROM checkout_attempts WHERE attempt_id=?")
					.bind(attempt.attempt_id)
					.run();
			} else if (session.status === "complete") {
				if (session.mode === "payment") await fulfillPass(env.DB, session);
				if (session.mode === "subscription") {
					const id =
						typeof session.subscription === "string"
							? session.subscription
							: session.subscription?.id;
					if (!id) throw Error("Completed checkout is missing its subscription");
					await reconcileSubscription(env.DB, client, attempt.user_id, id, now);
				}
			}
		} catch (error) {
			console.error(
				"Checkout recovery failed",
				attempt.attempt_id,
				error instanceof Error ? error.message : "Stripe or database error",
			);
			failures.push(error);
		}
	}
	if (failures.length)
		throw new AggregateError(failures, "Unresolved checkout attempts will be retried");
}

async function findUnacknowledgedSession(
	client: Stripe,
	attempt: { attempt_id: string; expires_at: number },
) {
	// Stripe accepted a creation within this hour if it committed before the local write failed.
	for await (const session of client.checkout.sessions.list({
		created: { gte: attempt.expires_at - 3601, lte: attempt.expires_at },
		limit: 100,
	})) {
		if (session.metadata?.attempt === attempt.attempt_id) return session;
	}
}

// A single durable attempt binds concurrent checkout requests to one Stripe session.
export async function checkoutSession(
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
				session = await findUnacknowledgedSession(client, attempt);
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
