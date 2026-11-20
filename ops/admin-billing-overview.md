# Admin business overview

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

## How the overview stays current

Stripe's signed `invoice.paid` webhook records new receipts as events arrive.
The production Stripe destination must subscribe to that event for immediate updates.

The hourly job at seven minutes past the hour starts a daily check using the
Worker's live key. The first scan reads paid invoices. Subsequent scans use
`invoice.paid` event time, so an older invoice paid today is included. Gaps
of 25 days or more trigger a full invoice scan because Stripe retains events for
30 days. Each run processes up to three pages. Receipts and the next cursor
commit together. On completion the marker advances to the start of that scan.
The next run overlaps this marker by five minutes.

The dashboard reads the database on open, every five minutes while visible, and
on return if its snapshot is stale. The timestamp beside the date controls is
the last successful read. The timestamp under subscriptions and receipts is the
last completed invoice check. A failed refresh preserves the displayed snapshot.
Before the first complete check, receipts and subscriber flows display a dash.
If a check is over 25 hours old, the page flags potentially incomplete figures.
Current paid accounts still come from the entitlement snapshot.

## Operations

Migration `0011_subscription_receipts.sql` created the ledger and completion
marker. To investigate a delayed check, inspect the hourly cron execution in
Workers logs and verify the Worker has a live Stripe key with invoice and event read access.
If daily reconciliation finds payments that were missing from the ledger, check
delivery of `invoice.paid` on the production Stripe destination.
