# Admin business overview (5.8.0)

The overview is organized into audience growth, agent activity, subscriptions and receipts,
and compact administrative counts. Existing MCP/CLI filtering remains
limited to request statistics. Charts share transparent surfaces and consistent
number formatting; the homepage is outside this change.

## Data and definitions

`user_subscriptions` is the current entitlement snapshot. Renewal updates replace
its previous period and price, so it cannot reconstruct historical revenue.
`subscription_receipts` stores paid recurring-subscription invoices, keyed by Stripe
invoice ID. Repeated webhook deliveries or reconciliations cannot double-count them.
The existing entitlement and checkout flows remain the source of access decisions.

- New subscribers: distinct payer identities on positive paid invoices with
  `billing_reason=subscription_create` within the selected payment window.
- Renewing subscribers: distinct identities on `subscription_cycle` invoices.
  A person may belong to both groups. Bucket counts are distinct within each bucket;
  their sum need not equal the whole-period distinct total.
- Identity uses the invoice's subscription metadata user ID, falling back to Stripe
  customer ID for historical invoices without that metadata.
- Receipts: invoice `amount_paid`, in integer minor units, by `paid_at`. Includes
  subscription adjustments; excludes zero-payment invoices and one-time passes.
  This is gross paid-invoice value, not net revenue, profit, or cash settlement;
  refunds and Stripe fees are not deducted. Currencies are never added together.
- UTC+8 buckets and half-open `[start,end)` payment windows match the overview.

On the first overview visit with no completed import, the browser automatically
starts one reconciliation attempt. Failures stop and offer a manual retry; changing
the date or channel does not start a retry loop. **Sync from Stripe** also uses the deployed Worker's existing secret
key through the admin-authenticated `/api/admin/billing-sync` endpoint. Keys never
reach the browser. Each request imports at most 100 paid invoices, and the browser
continues through every page. Completion is recorded only after the final page.
Test keys and test invoices are rejected, including an empty response from a test key.
Until the first complete reconciliation, financial figures display as unavailable,
not zero. The last reconciliation timestamp remains visible.

The webhook accepts `invoice.paid` for ongoing updates. Delivery requires that event
on the existing Stripe webhook subscription; production subscription settings have
not been inspected. Manual reconciliation also catches missed events. Treat the
visible reconciliation time as the verified coverage time, not a real-time guarantee.

## Verification and rollout

Apply migration `0011_subscription_receipts.sql` before publishing the Worker. It adds
two tables and an index; it does not rewrite account or subscription records.
SQL-backed checks cover payer deduplication, currencies, boundary times, and incomplete
history. Reconciliation tests cover admin authentication, test-mode rejection,
pagination completion, and idempotence. No layout or button-copy locks were added.

Production migration applied successfully. Production history had not yet been imported at the 5.8.3 investigation (zero receipts
and no completion marker). The first authenticated overview visit starts the import
using the Worker's production Stripe configuration. No owner key needs to be sent or
installed locally. A missing live key now returns a distinct configuration error.
