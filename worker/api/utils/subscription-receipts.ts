import type Stripe from "stripe";

export function subscriptionReceipt(invoice: Stripe.Invoice) {
	const details = invoice.parent?.subscription_details;
	if (
		!invoice.livemode ||
		invoice.status !== "paid" ||
		invoice.amount_paid <= 0 ||
		!details ||
		!invoice.status_transitions.paid_at
	)
		return null;
	const customer = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
	if (!customer) throw new Error("Paid subscription invoice has no customer");
	return [
		invoice.id,
		details.metadata?.userId ? `user:${details.metadata.userId}` : `customer:${customer}`,
		invoice.billing_reason ?? "unknown",
		invoice.currency.toUpperCase(),
		invoice.amount_paid,
		new Date(invoice.status_transitions.paid_at * 1000).toISOString(),
	] as const;
}
export const RECEIPT_SQL = `INSERT INTO subscription_receipts (invoice_id,customer_key,billing_reason,currency,amount_paid,paid_at) VALUES (?,?,?,?,?,?) ON CONFLICT(invoice_id) DO UPDATE SET customer_key=excluded.customer_key,billing_reason=excluded.billing_reason,currency=excluded.currency,amount_paid=excluded.amount_paid,paid_at=excluded.paid_at
 WHERE (customer_key,billing_reason,currency,amount_paid,paid_at) IS NOT
       (excluded.customer_key,excluded.billing_reason,excluded.currency,excluded.amount_paid,excluded.paid_at)`;
export async function recordSubscriptionReceipt(db: D1Database, invoice: Stripe.Invoice) {
	const row = subscriptionReceipt(invoice);
	if (row)
		await db
			.prepare(RECEIPT_SQL)
			.bind(...row)
			.run();
}
