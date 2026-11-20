import assert from "node:assert/strict";
import test from "node:test";
import { mapStripeStatus } from "./stripe.js";

test("maps Stripe subscription statuses to valid local values", () => {
	assert.equal(mapStripeStatus("active"), "active");
	assert.equal(mapStripeStatus("trialing"), "active");
	assert.equal(mapStripeStatus("canceled"), "canceled");
	assert.equal(mapStripeStatus("paused"), "canceled");
	assert.equal(mapStripeStatus("unpaid"), "past_due");
	assert.equal(mapStripeStatus("incomplete"), "inactive");
});

import Stripe from "stripe";
import { fixture } from "../../../packages/cli/test/fixture";
import stripe from "./stripe";

test("signed payment events grant once, keep currencies and isolate retired subscriptions", async (t) => {
	const f = await fixture();
	t.after(() => f.close());
	const env = {
		...f.env,
		STRIPE_SECRET_KEY: "sk_test_fixture",
		STRIPE_WEBHOOK_SECRET: "whsec_fixture",
	};
	const sdk = new Stripe(env.STRIPE_SECRET_KEY);
	async function deliver(type: string, object: Record<string, unknown>) {
		const payload = JSON.stringify({
			id: crypto.randomUUID(),
			object: "event",
			created: Math.floor(Date.now() / 1000),
			type,
			data: { object },
		});
		const header = await sdk.webhooks.generateTestHeaderStringAsync({
			payload,
			secret: env.STRIPE_WEBHOOK_SECRET,
		});
		return stripe.request(
			"/webhook",
			{ method: "POST", headers: { "stripe-signature": header }, body: payload },
			env,
		);
	}
	const session = {
		id: "cs_pass",
		mode: "payment",
		payment_status: "unpaid",
		customer: "cus_reader",
		metadata: { userId: "reader", priceId: "onetime_weekly" },
		currency: "cny",
		amount_total: 700,
	};
	const entitlement = () =>
		f.sql.prepare("SELECT * FROM user_subscriptions WHERE user_id='reader'").get();
	assert.equal((await deliver("checkout.session.completed", session)).status, 200);
	assert.equal(entitlement(), undefined);
	const paid = { ...session, payment_status: "paid" };
	const results = await Promise.all([
		deliver("checkout.session.async_payment_succeeded", paid),
		deliver("checkout.session.async_payment_succeeded", paid),
	]);
	assert.deepEqual(
		results.map((r) => r.status),
		[200, 200],
	);
	const period = entitlement()!;
	assert.equal(period.currency, "CNY");
	assert.equal(period.price, 7);
	assert.equal(
		Date.parse(String(period.current_period_end)) - Date.parse(String(period.current_period_start)),
		7 * 86400000,
	);
	await deliver("checkout.session.completed", { ...paid, id: "cs_another" });
	assert.equal(
		Date.parse(String(entitlement()!.current_period_end)) -
			Date.parse(String(period.current_period_end)),
		7 * 86400000,
	);
	const sub = {
		id: "sub_old",
		customer: "cus_reader",
		metadata: { userId: "reader" },
		status: "active",
		cancel_at_period_end: false,
		items: {
			data: [
				{
					current_period_start: 1790000000,
					current_period_end: 1795000000,
					price: {
						id: "price",
						currency: "usd",
						unit_amount: 300,
						recurring: { interval: "month", interval_count: 1 },
					},
				},
			],
		},
	};
	t.mock.method(Stripe.resources.Subscriptions.prototype, "retrieve", async (id: string) => ({
		...sub,
		id,
	}));
	const passEnd = entitlement()!.current_period_end;
	await deliver("customer.subscription.deleted", sub);
	assert.equal(entitlement()!.current_period_end, passEnd);
	f.sql.exec(
		"UPDATE user_subscriptions SET current_period_end='2020-01-01' WHERE user_id='reader'",
	);
	assert.equal(
		(await deliver("customer.subscription.created", { ...sub, id: "sub_new" })).status,
		200,
	);
	assert.equal(entitlement()!.stripe_subscription_id, "sub_new");
	await deliver("customer.subscription.updated", sub);
	await deliver("customer.subscription.deleted", sub);
	assert.equal(entitlement()!.stripe_subscription_id, "sub_new");
	assert.equal(
		(await deliver("checkout.session.completed", { ...paid, id: "cs_conflict" })).status,
		500,
	);
	assert.equal(
		f.sql.prepare("SELECT count(*) AS n FROM fulfilled_passes WHERE session_id='cs_conflict'").get()
			?.n,
		0,
	);
	const response = await stripe.request(
		"/subscription",
		{ headers: { Authorization: "Bearer " + f.webToken } },
		env,
	);
	assert.equal((await response.json()).data.currency, "USD");
});

test("concurrent checkout requests reuse one Stripe attempt and an active subscriber opens the portal", async (t) => {
	const f = await fixture();
	t.after(() => f.close());
	const env = {
		...f.env,
		STRIPE_SECRET_KEY: "sk_test_fixture",
		STRIPE_PRICE_ID_PRO_WEEKLY: "price_week",
		STRIPE_PRICE_ID_PRO_MONTHLY: "price_month",
	};
	const sessionIds = new Map<string, string>();
	const sessions = new Map<string, { id: string; status: string; url: string }>();
	const sdk = new Stripe(env.STRIPE_SECRET_KEY);
	const checkout = Object.getPrototypeOf(sdk.checkout.sessions);
	t.mock.method(
		checkout,
		"create",
		async (params: Stripe.Checkout.SessionCreateParams, opts: { idempotencyKey: string }) => {
			assert.equal(params.metadata?.attempt, opts.idempotencyKey);
			const id = sessionIds.get(opts.idempotencyKey) ?? crypto.randomUUID();
			sessionIds.set(opts.idempotencyKey, id);
			const session = { id, url: "https://checkout.example.test/" + id, status: "open" };
			sessions.set(id, session);
			return session;
		},
	);
	t.mock.method(checkout, "retrieve", async (id: string) => sessions.get(id));
	t.mock.method(checkout, "expire", async (id: string) => {
		sessions.get(id)!.status = "expired";
	});
	t.mock.method(Object.getPrototypeOf(sdk.billingPortal.sessions), "create", async () => ({
		url: "https://portal.example.test/manage",
	}));
	const buy = (priceId = "weekly") =>
		stripe.request(
			"/checkout",
			{
				method: "POST",
				headers: { Authorization: "Bearer " + f.webToken, "Content-Type": "application/json" },
				body: JSON.stringify({ priceId }),
			},
			env,
		);
	const results = await Promise.all([buy(), buy()]);
	assert.deepEqual(
		results.map((r) => r.status),
		[200, 200],
	);
	const [a, b] = await Promise.all(results.map((r) => r.json()));
	assert.equal(a.data.url, b.data.url);
	assert.equal(sessionIds.size, 1);
	assert.equal((await buy("monthly")).status, 200);
	assert.equal([...sessions.values()].filter((s) => s.status === "open").length, 1);
	f.sql.exec(
		"INSERT INTO user_subscriptions(user_id,plan_type,stripe_customer_id,stripe_subscription_id) VALUES('reader','pro','cus_reader','sub_reader')",
	);
	assert.equal((await (await buy()).json()).data.url, "https://portal.example.test/manage");
	assert.equal(sessionIds.size, 2);
});
