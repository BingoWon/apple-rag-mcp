import type Stripe from "stripe";
import { createStripeClient, STRIPE_API_VERSION } from "../api/utils/stripe-client";
import { RECEIPT_SQL, subscriptionReceipt } from "../api/utils/subscription-receipts";
import type { Env } from "../shared/types";

type Scan = { since: number | null; until_at: number; cursor: string | null };

export async function reconcileBilling(
	env: Pick<Env, "DB" | "STRIPE_SECRET_KEY">,
	scheduledTime: number,
) {
	const db = env.DB;
	const last = await db
		.prepare("SELECT completed_at FROM billing_history_sync WHERE id=1")
		.first<{ completed_at: string }>();
	const until = Math.floor(scheduledTime / 1000);
	const previous = last ? Date.parse(last.completed_at) / 1000 : 0;
	if (previous >= Math.floor(until / 86400) * 86400) return;
	if (!/^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY ?? ""))
		throw Error("Live Stripe billing is not configured");
	const stripe = createStripeClient(env.STRIPE_SECRET_KEY);
	// Events expire after 30 days. Leave room for a delayed scan and overlap the watermark.
	const since = previous && until - previous < 25 * 86400 ? Math.floor(previous) - 300 : null;
	await db
		.prepare(
			`INSERT INTO billing_scan(id,since,until_at) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET since=NULL,until_at=excluded.until_at,cursor=NULL WHERE billing_scan.since<excluded.until_at-25*86400`,
		)
		.bind(since, until)
		.run();
	for (let pages = 0; pages < 3; pages++) {
		const scan = await db
			.prepare("SELECT since,until_at,cursor FROM billing_scan WHERE id=1")
			.first<Scan>();
		if (!scan) return;
		const paging = {
			limit: scan.since === null ? 75 : 12,
			starting_after: scan.cursor ?? undefined,
		};
		let invoices: Stripe.Invoice[];
		let next: string | null;
		let hasMore: boolean;
		if (scan.since === null) {
			const page = await stripe.invoices.list({
				...paging,
				status: "paid",
				created: { lte: scan.until_at },
			});
			invoices = page.data;
			next = page.data.at(-1)?.id ?? null;
			hasMore = page.has_more;
		} else {
			const page = await stripe.events.list({
				...paging,
				type: "invoice.paid",
				created: { gte: scan.since, lte: scan.until_at },
			});
			invoices = [];
			for (const event of page.data) {
				if (event.type !== "invoice.paid") throw Error("Unexpected Stripe event type");
				const snapshot = event.data.object;
				if (!snapshot.id) throw Error("Paid invoice has no identifier");
				invoices.push(
					event.api_version === STRIPE_API_VERSION
						? snapshot
						: await stripe.invoices.retrieve(snapshot.id),
				);
			}
			next = page.data.at(-1)?.id ?? null;
			hasMore = page.has_more;
		}
		if (hasMore && (!next || next === scan.cursor))
			throw Error("Stripe billing pagination did not advance");
		const writes = [];
		for (const invoice of invoices) {
			if (!invoice.livemode) throw Error("Production billing requires live invoices");
			const row = subscriptionReceipt(invoice);
			if (row) writes.push(db.prepare(RECEIPT_SQL).bind(...row));
		}
		if (hasMore)
			writes.push(
				db
					.prepare("UPDATE billing_scan SET cursor=? WHERE id=1 AND until_at=? AND cursor IS ?")
					.bind(next, scan.until_at, scan.cursor),
			);
		else {
			writes.push(
				db
					.prepare(`INSERT INTO billing_history_sync(id,completed_at)
 SELECT 1,? FROM billing_scan WHERE id=1 AND until_at=? AND cursor IS ?
 ON CONFLICT(id) DO UPDATE SET completed_at=max(completed_at,excluded.completed_at)`)
					.bind(new Date(scan.until_at * 1000).toISOString(), scan.until_at, scan.cursor),
			);
			writes.push(
				db
					.prepare("DELETE FROM billing_scan WHERE id=1 AND until_at=? AND cursor IS ?")
					.bind(scan.until_at, scan.cursor),
			);
		}
		await db.batch(writes);
		if (!hasMore) return;
	}
}
