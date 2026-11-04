import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type Stripe from "stripe";
import { recordSubscriptionReceipt, subscriptionReceipt } from "../utils/subscription-receipts";

test("paid invoice ledger excludes free and unpaid invoices and is idempotent", async (t) => {
	const sql = new DatabaseSync(":memory:");
	t.after(() => sql.close());
	sql.exec(
		readFileSync(
			new URL("../../../migrations/0011_subscription_receipts.sql", import.meta.url),
			"utf8",
		),
	);
	const invoice = {
		id: "in_test",
		livemode: true,
		status: "paid",
		amount_paid: 100,
		currency: "usd",
		customer: "cus_a",
		billing_reason: "subscription_cycle",
		status_transitions: { paid_at: 1793764800 },
		parent: { subscription_details: { metadata: { userId: "reader" } } },
	} as unknown as Stripe.Invoice;
	assert.equal(subscriptionReceipt({ ...invoice, status: "open" }), null);
	assert.equal(subscriptionReceipt({ ...invoice, livemode: false }), null);
	assert.equal(subscriptionReceipt({ ...invoice, amount_paid: 0 }), null);
	assert.equal(subscriptionReceipt({ ...invoice, parent: null }), null);
	const db = {
		prepare: (query: string) => ({
			bind: (...values: (string | number)[]) => ({
				run: async () => sql.prepare(query).run(...values),
			}),
		}),
	} as unknown as D1Database;
	await recordSubscriptionReceipt(db, invoice);
	await recordSubscriptionReceipt(db, invoice);
	assert.deepEqual(
		{ ...sql.prepare("SELECT customer_key,amount_paid,currency FROM subscription_receipts").get() },
		{ customer_key: "user:reader", amount_paid: 100, currency: "USD" },
	);
	assert.equal(sql.prepare("SELECT COUNT(*) AS count FROM subscription_receipts").get()?.count, 1);
});
