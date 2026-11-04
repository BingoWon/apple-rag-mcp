import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import Stripe from "stripe";
import app from "./admin/index";

test("billing reconciliation requires admin access and live data, and completes only after the last page", async (t) => {
	const sql = new DatabaseSync(":memory:");
	t.after(() => sql.close());
	sql.exec(
		readFileSync(
			new URL("../../../migrations/0011_subscription_receipts.sql", import.meta.url),
			"utf8",
		),
	);
	const db = {
		prepare: (query: string) => ({
			bind: (...values: (string | number)[]) => ({
				run: async () => sql.prepare(query).run(...values),
			}),
		}),
		batch: async (statements: { run: () => unknown }[]) =>
			Promise.all(statements.map((s) => s.run())),
	};
	const env = {
		ADMIN_PASSWORD: "test-admin",
		STRIPE_SECRET_KEY: "sk_live_fixture",
		DB: db as unknown as D1Database,
	};
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
	let page = { data: [invoice], has_more: true };
	const list = t.mock.method(Stripe.resources.Invoices.prototype, "list", async () => page);
	const request = (
		body: unknown = {},
		headers: Record<string, string> = { "X-Admin-Password": "test-admin" },
		bindings = env,
	) =>
		app.request(
			"/billing-sync",
			{
				method: "POST",
				headers: { ...headers, "Content-Type": "application/json" },
				body: JSON.stringify(body),
			},
			bindings,
		);
	assert.equal((await request({}, {})).status, 401);
	assert.equal((await request({ cursor: "bad" })).status, 400);
	const notConfigured = await request({}, undefined, {
		...env,
		STRIPE_SECRET_KEY: "sk_test_fixture",
	});
	assert.equal(notConfigured.status, 503);
	assert.equal((await notConfigured.json()).error.code, "BILLING_NOT_CONFIGURED");
	assert.equal(list.mock.callCount(), 0);
	const first = await (await request()).json();
	assert.equal(first.data.cursor, "in_A");
	assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM billing_history_sync").get()?.n, 0);
	page = { data: [invoice], has_more: false };
	assert.equal((await request({ cursor: "in_A" })).status, 200);
	assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM subscription_receipts").get()?.n, 1);
	assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM billing_history_sync").get()?.n, 1);
});
