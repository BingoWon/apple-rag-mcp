# Account and retrieval integrity

## Website and agent credentials

The website issues a 24-hour, audience-bound session. D1 checks its session ID on
each authenticated request. Logout revokes that session. A password change or
reset revokes every website session for that user. Existing sessions issued
before this release require a fresh sign-in. MCP tokens, CLI devices and
automation keys have their own credentials and revocation paths.

Google and GitHub callbacks validate browser-bound state. A path-scoped HttpOnly
cookie exchanges the pending login once within 60 seconds. The redirect URL
contains only a completion marker. Dashboard requests are discarded after an
account change, including responses that arrive after logout.

MCP IP authorization uses the Cloudflare client address in canonical form.
An address associated with multiple accounts grants anonymous access only.
A bearer token identifies a specific account on a shared network.

## Checkout and receipts

One outstanding checkout per account binds a Stripe idempotency key to its
original parameters. Switching prices expires the previous open checkout.
Existing recurring subscribers manage their subscription in the Stripe portal.
A completed checkout awaiting its webhook blocks competing purchases.

Subscribe the live Stripe destination to `customer.subscription.created`,
`customer.subscription.updated`, `customer.subscription.deleted`,
`checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed`, `checkout.session.expired` and
`invoice.paid`. An unpaid checkout waits for confirmation. A paid pass and its
fulfillment record commit together. Replaying an event cannot extend it twice.
Conflicting paid entitlements return a retryable error and require investigation
in Stripe before any refund or cancellation. Recurring updates read the current
Stripe subscription, compare the local revision, and respect retired subscription
IDs. The daily receipt check is described in [Admin billing](admin-billing-overview.md).

## Storage and rollout

Apply D1 migration `0016_account_integrity.sql` before deploying the Worker.
It adds web sessions, checkout and billing state, quota reservations and log
pagination indexes. The existing recurring catalog used USD. Historic one-time
passes without a recorded currency keep a null currency. Historical Stripe
checkout IDs seed the fulfillment ledger. The migration preserves tool-call logs.
New fetch logs retain only the origin and path.

A tool request reserves both quota windows atomically. A failed tool call refunds
the reservation by request ID. An ambiguous reservation acknowledgement uses
the same ID to cancel the reservation. Hourly maintenance expires old reservations.

Apply `ops/server/postgresql_keyword_symbols.sql` with psql on the corpus database.
The concurrent partial index covers normalized symbols in the first chunk of each
document. Search takes up to the requested limit of exact symbols and fills the
remaining places from a bounded full-text candidate set. This keeps common terms
from ranking every matching chunk.

Collector page content and its replacement chunks commit together. Temporary
subtitle or extraction failures retain the last usable version. If PostgreSQL
is unavailable, an official JSON page can still be read live. Third-party reads
require a successful budget reservation.
