import { createStripeClient } from "../api/utils/stripe-client";
import { RECEIPT_SQL, subscriptionReceipt } from "../api/utils/subscription-receipts";
import type { Env } from "../shared/types";

export async function reconcileBilling(
	env: Pick<Env, "DB" | "STRIPE_SECRET_KEY">,
	scheduledTime: number,
) {
	const day = new Date(scheduledTime).toISOString().slice(0, 10);
	const complete = await env.DB.prepare(
		"SELECT 1 FROM billing_history_sync WHERE id=1 AND completed_at >= ?",
	)
		.bind(day)
		.first();
	if (complete) return;
	if (!/^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY ?? ""))
		throw new Error("Live Stripe billing is not configured");

	const stripe = createStripeClient(env.STRIPE_SECRET_KEY);
	let cursor: string | undefined;
	for (;;) {
		const page = await stripe.invoices.list({ status: "paid", limit: 100, starting_after: cursor });
		const statements = [];
		for (const invoice of page.data) {
			if (!invoice.livemode) throw new Error("Production billing requires live invoices");
			const row = subscriptionReceipt(invoice);
			if (row) statements.push(env.DB.prepare(RECEIPT_SQL).bind(...row));
		}
		if (!page.has_more) {
			statements.push(
				env.DB.prepare(
					"INSERT INTO billing_history_sync(id,completed_at) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET completed_at=excluded.completed_at",
				).bind(new Date().toISOString()),
			);
		}
		if (statements.length) await env.DB.batch(statements);
		if (!page.has_more) return;
		const next = page.data.at(-1)?.id;
		if (!next || next === cursor) throw new Error("Stripe invoice pagination did not advance");
		cursor = next;
	}
}
