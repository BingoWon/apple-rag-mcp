# Admin user-name presentation

All admin tables except the Users page identify people by their current account name.
Subscriptions, MCP tokens, authorized IPs, search/fetch logs, contact messages and their
detail/reply views share one identity resolver and one localized name formatter.

The resolver fetches account names for a page in one query. It strips user IDs from
list responses. Anonymous identities receive stable visitor nicknames with a numeric
discriminator derived from a digest, rather than exposing `anon_*` keys or IP-derived
identifiers. Missing accounts are labelled deleted; blank or email-shaped account
names receive an unnamed-user label. These labels are display aids, not verified
identities, and are not used for authorization. Names and nicknames can coincide;
underlying record IDs continue to identify actions.

The subscriptions list no longer queries or returns Stripe customer, subscription,
or price IDs. Those fields remain in the payment system where required. Contact
message lists expose only reply/email availability flags; email delivery still
resolves the recipient on the server. Users remains the page for account identifiers
and email addresses. Log text filters now support account names instead of user IDs.

Removed obsolete columns, translations, name joins, duplicated contact-message types,
and duplicate contact-name rendering. No migration is required. SQL-backed route
checks cover all affected lists, stable aliases, deleted accounts, name filtering,
reply availability, and retained account details on Users.
