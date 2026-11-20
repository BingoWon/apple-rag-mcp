import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import Stripe from "stripe";
import { reconcileBilling } from "./billing-reconciliation";

test("scheduled invoice reconciliation retries incomplete history and counts each paid invoice once", async (t) => {
	const sql = new DatabaseSync(":memory:");
	t.after(() => sql.close());
	sql.exec(
		readFileSync(
			new URL("../../migrations/0011_subscription_receipts.sql", import.meta.url),
			"utf8",
		),
	);
	const db = {
		prepare: (query: string) => ({
			bind: (...values: (string | number)[]) => ({
				first: async () => sql.prepare(query).get(...values),
				run: () => sql.prepare(query).run(...values),
			}),
		}),
		batch: async (statements: { run: () => unknown }[]) => statements.map((s) => s.run()),
	};
	const env = { STRIPE_SECRET_KEY: "sk_live_fixture", DB: db as unknown as D1Database };
	const now = Date.now();
	const invoice = {
		id: "in_A",
		livemode: true,
		status: "paid",
		amount_paid: 100,
		currency: "usd",
		customer: "cus_A",
		billing_reason: "subscription_create",
		status_transitions: { paid_at: 1793764800 },
		parent: { subscription_details: { metadata: { userId: "reader" } } },
	};
	let failSecondPage = true;
	const list = t.mock.method(
		Stripe.resources.Invoices.prototype,
		"list",
		async ({ starting_after }: { starting_after?: string }) => {
			if (!starting_after) return { data: [invoice], has_more: true };
			assert.equal(starting_after, "in_A");
			if (failSecondPage) throw new Error("Stripe unavailable");
			return { data: [{ ...invoice, id: "in_B" }], has_more: false };
		},
	);
	const completedAt = () =>
		sql.prepare("SELECT completed_at FROM billing_history_sync WHERE id=1").get()?.completed_at;
	const total = () =>
		sql.prepare("SELECT SUM(amount_paid) AS amount FROM subscription_receipts").get()?.amount;

	await assert.rejects(
		reconcileBilling({ ...env, STRIPE_SECRET_KEY: "sk_test_fixture" }, now),
		/Live Stripe/,
	);
	assert.equal(list.mock.callCount(), 0);
	await assert.rejects(reconcileBilling(env, now), /Stripe unavailable/);
	assert.equal(completedAt(), undefined);
	assert.equal(total(), 100);
	failSecondPage = false;
	await reconcileBilling(env, now);
	assert.ok(completedAt());
	assert.equal(total(), 200);
	const calls = list.mock.callCount();
	await reconcileBilling(env, now);
	assert.equal(list.mock.callCount(), calls);

	sql.exec("UPDATE billing_history_sync SET completed_at='2000-01-01T00:00:00.000Z'");
	list.mock.mockImplementation(async () => ({
		data: [{ ...invoice, livemode: false }],
		has_more: false,
	}));
	await assert.rejects(reconcileBilling(env, now), /live invoices/);
	list.mock.mockImplementation(async () => ({ data: [], has_more: true }));
	await assert.rejects(reconcileBilling(env, now), /pagination/);
	assert.equal(completedAt(), "2000-01-01T00:00:00.000Z");
	list.mock.mockImplementation(async () => ({ data: [], has_more: false }));
	await reconcileBilling(env, now);
	assert.notEqual(completedAt(), "2000-01-01T00:00:00.000Z");
	assert.equal(total(), 200);
});
