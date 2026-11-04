import { z } from "zod";
import { createOpenAPIApp } from "../../utils/openapi";
import { createStripeClient } from "../../utils/stripe-client";
import { RECEIPT_SQL, subscriptionReceipt } from "../../utils/subscription-receipts";

const app = createOpenAPIApp();
app.post("/", async (c) => {
	const body = z
		.object({
			cursor: z
				.string()
				.regex(/^in_[A-Za-z0-9]+$/)
				.optional(),
		})
		.safeParse(await c.req.json().catch(() => null));
	if (!body.success)
		return c.json({ success: false, error: { message: "Invalid sync cursor" } }, 400);
	if (!/^(sk|rk)_live_/.test(c.env.STRIPE_SECRET_KEY ?? ""))
		return c.json(
			{
				success: false,
				error: {
					code: "BILLING_NOT_CONFIGURED",
					message: "Live Stripe billing is not configured.",
				},
			},
			503,
		);
	try {
		const stripe = createStripeClient(c.env.STRIPE_SECRET_KEY);
		const page = await stripe.invoices.list({
			status: "paid",
			limit: 100,
			...(body.data.cursor ? { starting_after: body.data.cursor } : {}),
		});
		const statements = [];
		for (const invoice of page.data) {
			if (!invoice.livemode) throw new Error("Production billing requires live invoices");
			const row = subscriptionReceipt(invoice);
			if (row) statements.push(c.env.DB.prepare(RECEIPT_SQL).bind(...row));
		}
		if (statements.length) await c.env.DB.batch(statements);
		if (!page.has_more)
			await c.env.DB.prepare(
				"INSERT INTO billing_history_sync(id,completed_at) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET completed_at=excluded.completed_at",
			)
				.bind(new Date().toISOString())
				.run();
		return c.json({ success: true, data: { cursor: page.has_more ? page.data.at(-1)?.id : null } });
	} catch {
		return c.json(
			{ success: false, error: { message: "Could not reconcile Stripe invoices. Please retry." } },
			502,
		);
	}
});
export default app;
