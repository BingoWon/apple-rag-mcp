# Admin user-name presentation

All admin tables except the Users page identify people by their current account name.
Subscriptions, MCP tokens, authorized IPs, search/fetch logs, contact messages and their
detail/reply views share one identity resolver and one localized name formatter.

The resolver fetches account names for a page in one query. It strips user IDs from
list responses. Anonymous labels are the localized “匿名用户” prefix followed directly by the last
six alphanumeric characters of the IP, with punctuation removed and IPv6 letters
lowercased. For example, `203.0.113.17` becomes `匿名用户011317`, and
`2001:db8::1234:abcd` becomes `匿名用户34abcd`.

The resolver uses the stored request IP, or the literal IP in the old `anon_` key.
Missing or invalid IPs produce only the anonymous label. No hashes, generated
nicknames, colors, animals, or substitute record IDs are used. Short IP suffixes can
coincide and do not establish a person's identity. Registered names remain unchanged;
missing accounts and unnamed accounts receive their respective plain labels.

The subscriptions list no longer queries or returns Stripe customer, subscription,
or price IDs. Those fields remain in the payment system where required. Contact
message lists expose only reply/email availability flags; email delivery still
resolves the recipient on the server. Users remains the page for account identifiers
and email addresses. Log text filters now support account names instead of user IDs.

Removed obsolete columns, translations, name joins, duplicated contact-message types,
and duplicate contact-name rendering. No migration is required. SQL-backed route
checks cover all affected lists, IPv4/IPv6 suffixes, deleted accounts, name filtering,
reply availability, and retained account details on Users.
