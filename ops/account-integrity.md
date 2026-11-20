# Account and retrieval integrity

## Review follow-up

The 19 findings were reported against `cde32b6`. Release 5.15.0 implemented
website sessions, payment deduplication, account isolation, atomic quotas and
index replacement, log redaction, and the retrieval and billing indexes.
Release 5.15.1 addresses these remaining failure paths.

- Email and OAuth registration must commit the account and its first session
  together. Failed signing and rolled-back writes leave the email available for
  retry. If the transaction committed and its response was lost, the account can sign in.
- An OAuth return must finish before any private dashboard content mounts.
  Changing accounts must also discard component-local forms, CLI approval dialogs,
  contact drafts and unread replies.
  Consume each browser-bound OAuth attempt once in D1. Independent tabs receive
  independent return cookies. Only a public attempt ID appears on the return page.
- A completed Checkout can outlive a missed webhook. Recheck outstanding
  sessions on the existing hourly schedule against Stripe and use the same
  fulfillment transaction. Leave pending payments unfulfilled and keep unrelated
  accounts progressing if one reconciliation fails.
- Returning from Checkout or the billing portal proves only that the browser
  returned. The billing page displays the account's recorded entitlement.

Verify these paths with local database failures, duplicate and delayed Stripe
deliveries, and account switches. Historical fetch logs retain their existing
URLs. The redaction policy applies to new log writes.

The release check covers registration and session rollback (findings 1–2),
Stripe event ordering, fulfillment and display (3–5, 11, 18–19), dashboard
and identity isolation (6–8, 14–15), atomic quota and collector writes (9–10),
fetch fallback and redaction (12–13), and pagination and keyword retrieval (16–17).

## Website and agent credentials

The website issues a 24-hour, audience-bound session. D1 checks its session ID on
each authenticated request. Logout revokes that session. A password change or
reset revokes every website session for that user. Existing sessions issued
before 5.15.0 require a fresh sign-in. A login already in progress during the
5.15.1 rollout can be restarted. Sessions issued by 5.15.0 remain valid. MCP tokens, CLI devices and
automation keys have their own credentials and revocation paths.

Google and GitHub callbacks consume a ten-minute attempt bound to the initiating browser and provider. A path-scoped HttpOnly
cookie exchanges the pending login once within 60 seconds. The redirect URL
contains only the public attempt ID. Dashboard requests are discarded after an
account change, including responses that arrive after logout.

MCP IP authorization uses the Cloudflare client address in canonical form.
An address associated with multiple accounts grants anonymous access only.
A bearer token identifies a specific account on a shared network.
Token rename and revocation update the dashboard after D1 confirms the
mutation. Contact messages take their owner from the authenticated request.
The CLI replaces saved credentials under a lock and revokes the displaced session.

## Checkout and receipts

One outstanding checkout per account binds a Stripe idempotency key to its
original parameters. Switching prices expires the previous open checkout.
Existing recurring subscribers manage their subscription in the Stripe portal.
A completed checkout awaiting fulfillment blocks competing purchases. The hourly
job claims up to 12 outstanding attempts, checks Stripe and releases expired or
failed checkouts. When Stripe created a session but its ID was never saved,
recovery checks the original creation window before releasing the attempt.
Verification uses Stripe’s live-mode flag and matching account and attempt IDs.
A subscription activation alert follows the confirmed transition to active.

Subscribe the live Stripe destination to `customer.subscription.created`,
`customer.subscription.updated`, `customer.subscription.deleted`,
`checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed`, `checkout.session.expired` and
`invoice.paid`. An unpaid checkout waits for confirmation. A paid pass and its
fulfillment record commit together. Replaying an event cannot extend it twice.
Conflicting paid entitlements return a retryable error and require investigation
in Stripe before any refund or cancellation. Recurring updates read the current
Stripe subscription, compare the local revision, and respect retired subscription
IDs. Hosted Checkout handles payments and the website displays the recorded
currency. The quota shown on the billing page uses the same effective plan
as tool requests. The daily receipt check is described in [Admin billing](admin-billing-overview.md).

## Storage and rollout

Apply D1 migrations through `0017_auth_and_checkout_recovery.sql` before deploying the Worker.
Migration 0016 adds web sessions, checkout and billing state, quota reservations and log
pagination indexes. The existing recurring catalog used USD. Migration 0017 adds expiring OAuth attempts and the checkout retry time. Historic one-time
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
