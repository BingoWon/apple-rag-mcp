import assert from "node:assert/strict";
import test from "node:test";
import Stripe from "stripe";
import { fixture } from "../../../packages/cli/test/fixture";
import { reconcileCheckouts } from "./stripe-checkout";

test("hourly recovery verifies owners, retries pending payments and fulfills offline checkouts once", async (t) => {
	const f = await fixture();
	t.after(() => f.close());
	const env = { ...f.env, STRIPE_SECRET_KEY: "sk_live_fixture" };
	const sdk = new Stripe(env.STRIPE_SECRET_KEY);
	const now = Date.now();
	const users = [
		"delayed",
		"expired",
		"failed",
		"other",
		"subscription",
		"open",
		"mismatched",
		"offline",
	];
	for (const id of users) {
		f.sql
			.prepare(
				"INSERT INTO users(id,email,created_at,updated_at) VALUES(?,?,datetime('now'),datetime('now'))",
			)
			.run(id, id + "@example.test");
		f.sql
			.prepare(
				"INSERT INTO checkout_attempts(user_id,attempt_id,price_id,expires_at,session_id,parameters) VALUES(?,?,'price',?,?, '{}')",
			)
			.run(id, id, Math.floor(now / 1000), id);
	}
	f.sql
		.prepare(
			"INSERT INTO checkout_attempts(user_id,attempt_id,price_id,expires_at,parameters) VALUES('reader','abandoned','price',?, '{}')",
		)
		.run(Math.floor(now / 1000) - 3600);
	t.mock.method(Object.getPrototypeOf(sdk.checkout.sessions), "list", () =>
		(async function* () {})(),
	);
	let settled = false;
	const retrieve = t.mock.method(
		Object.getPrototypeOf(sdk.checkout.sessions),
		"retrieve",
		async (id: string) => {
			if (id === "offline") throw Error("Stripe offline");
			const pending = (id === "delayed" && !settled) || id === "failed";
			return {
				id,
				livemode: true,
				status: id === "expired" ? "expired" : id === "open" ? "open" : "complete",
				mode: id === "subscription" ? "subscription" : "payment",
				subscription: id === "subscription" ? "sub_recurring" : null,
				client_reference_id: id,
				metadata: {
					attempt: id,
					userId: id === "mismatched" ? "other" : id,
					priceId: "onetime_weekly",
				},
				payment_status: pending ? "unpaid" : "paid",
				currency: "cny",
				amount_total: 700,
				payment_intent: id === "failed" ? { status: "canceled" } : null,
			};
		},
	);
	t.mock.method(Stripe.resources.Subscriptions.prototype, "retrieve", async () => ({
		id: "sub_recurring",
		customer: "cus_recurring",
		status: "active",
		cancel_at_period_end: false,
		metadata: { attempt: "subscription", userId: "subscription" },
		items: {
			data: [
				{
					current_period_start: 1700000000,
					current_period_end: 1900000000,
					price: {
						id: "price",
						currency: "usd",
						unit_amount: 300,
						recurring: { interval: "month", interval_count: 1 },
					},
				},
			],
		},
	}));
	const attempt = (id: string) =>
		f.sql.prepare("SELECT 1 FROM checkout_attempts WHERE attempt_id=?").get(id);
	const sub = (id: string) =>
		f.sql.prepare("SELECT * FROM user_subscriptions WHERE user_id=?").get(id);
	await assert.rejects(reconcileCheckouts(env, now), AggregateError);
	for (const id of ["expired", "failed", "subscription", "other", "abandoned"])
		assert.equal(attempt(id), undefined);
	for (const id of ["offline", "mismatched", "open", "delayed"]) assert.ok(attempt(id));
	assert.equal(sub("delayed"), undefined);
	assert.equal(sub("mismatched"), undefined);
	assert.equal(sub("subscription")?.stripe_subscription_id, "sub_recurring");
	assert.equal(sub("other")?.currency, "CNY");
	const expiry = sub("other")?.current_period_end;
	settled = true;
	await reconcileCheckouts(env, now);
	assert.equal(retrieve.mock.callCount(), users.length);
	await assert.rejects(reconcileCheckouts(env, now + 3600000), AggregateError);
	assert.equal(sub("delayed")?.price, 7);
	assert.equal(expiry, sub("other")?.current_period_end);
	assert.equal(f.sql.prepare("SELECT count(*) n FROM fulfilled_passes").get()?.n, 2);
});
