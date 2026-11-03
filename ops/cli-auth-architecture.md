# Independent CLI authorization and request channels

Implemented: 2026-11-03. Service 5.5.2; CLI 2.0.0. Production acceptance and
migration results are recorded in [the acceptance report](cli-auth-acceptance-2026-11-03.md).

## Boundaries

| Concern | Implementation |
| --- | --- |
| Accounts, subscriptions, quotas | One platform user ID and the existing quota counters |
| MCP | Existing `at_` tokens and authorized IPs; Streamable HTTP, including legacy initialize |
| CLI | Independent device grants / API keys; JSON HTTP `/api/cli/v1` on `apple-rag.com` |
| Website | Existing website login approves grants and manages CLI sessions; never copied to the CLI |
| Retrieval | Shared `worker/services`: validation, reservation/refund, search/fetch, results and logs |
| Contracts | Neutral `shared/contracts.ts`, bundled into the CLI; no Worker → CLI-source dependency |

The CLI has no MCP SDK or MCP transport. CLI credentials are rejected by MCP and
website management APIs. MCP tokens and website JWTs are rejected by the CLI API.
CLI does not infer identity from the MCP IP allowlist. Sharing one subscription
does not issue a second free allowance. Anonymous limits also share the same IP
counter across the two entries.

## Login and credentials

`apple-rag auth login` uses OAuth authorization code with S256 PKCE. It binds an
OS-assigned loopback IP port at `/callback`, opens the platform authorization page,
and verifies state, issuer, path, method and Host on return. Only explicit HTTP
loopback IP callbacks are allowed. The website shows the account, device name and
read-only documentation permissions; approval is never automatic. `--no-browser`
prints the URL without launching a browser.

`auth login --device` uses the Device Authorization Grant for a terminal whose
callback cannot be reached. Requests expire after 10 minutes; polling starts at
five seconds and backs off on `slow_down`. Device codes and user codes are hashed
in D1, and website consent remains required. Both grants are single-use and
conditionally consumed in an atomic D1 batch. The public client is `apple-rag-cli`;
it has no client secret. Only `documents:search documents:fetch` is granted.

Access JWTs last 15 minutes and carry issuer, audience, client, scope and session
claims. Their signing key is HKDF-derived from the website JWT secret with a
CLI-specific context, so removing the `ar_cli_a_` prefix does not turn them into
website sessions. The audience is the platform origin plus `/api/cli/v1`.
Refresh JWTs have a separate type/prefix, expire with the device session after
30 days, rotate on every use and are stored hashed server-side. Replaying a used
refresh credential revokes the device family. Every access checks current D1
session state, so revocation also invalidates unexpired access tokens immediately.

The OS vault stores access and refresh credentials (`@napi-rs/keyring`): macOS
Keychain, Windows Credential Manager, Linux Secret Service. Linux deliberately
requires a persistent protected vault instead of silently falling back to a
session keyring. Files under `~/.config/apple-rag-cli` contain only endpoint
metadata (directory 0700, file 0600 on POSIX), never tokens. Vault entries are
bound to endpoint and configuration directory. A per-entry filesystem lock
serializes refresh across CLI processes. Login refuses an overriding environment
credential. Logout revokes the device server-side before removing local state.
A failed revocation leaves state available for retry.

Headless automation uses a separate CLI API key generated in website Settings →
CLI access. Keys expire in at most 90 days, are displayed once, and only their
SHA-256 hash is stored. Set `APPLE_RAG_TOKEN` through a secret manager. It takes
precedence even when invalid and never falls back to another identity. It cannot
manage the website, billing, MCP tokens or other CLI sessions. There are at most
20 active devices/keys per account; inserts enforce this bound atomically.
Website settings list and revoke individual devices/keys without affecting MCP.

Account/health/authorization do not spend retrieval quota. Entitlements are read
from current subscriptions server-side. No billing data is trusted from a JWT or
client header. Scheduled cleanup deletes expired authorizations, short
rate-limit windows and sessions expired/revoked over seven days ago.

## Logs and data cutover

Both search and fetch record server-selected `channel` (`mcp`, `cli`, `unknown`),
`credential_id`, `session_id`, `auth_method`, generated `request_id`, diagnostic
`client_name` and `client_version`. CLI HTTP replies include `X-Request-ID` and
structured results include `request_id`. Existing source/provider/cache/outcome
fields keep their separate meaning. Invalid inputs, limits, retrieval failures
and cancellation use the same shared orchestration. CLI auth rejection is HTTP
401, distinguishable from retrieval failure and recorded without a credential.

`channel` identifies the entry/resource, not proof of the running executable.
Names/version headers are untrusted diagnostic text, capped in length. A curl
client using its own CLI key is still a CLI API request. No self-reported header
can change channel or entitlement. User history also shows the verified channel and credential references; its combined
search/fetch query preserves user isolation and includes 4xx outcomes as errors.
Admin uses the existing shared table/details
components, with channel badges/filter in both views and credential IDs instead
of masked secret values.

The old implementation persisted bearer MCP tokens in log rows; masking the UI
was insufficient. Migration 0009 maps surviving token IDs, clears those secrets,
and temporarily scrubs old Worker inserts during rollout. Old rows remain
`unknown`; their exact client is not inferred. After the new Worker is confirmed,
0010 removes the temporary triggers and obsolete secret columns. There is no manual table-copy rebuild or PostgreSQL corpus change. SQLite may
rewrite storage during DROP COLUMN; account for those D1 writes. Inspect live schema,
D1 Time Travel bookmark, row counts and write budget before applying. Existing
backup retention can still contain historical secrets; do not claim it is erased
by an application-table migration.

This intentionally breaks CLI 1.x credential reuse. Upgrade to 2.x and log in
again; no legacy token/file migration or MCP-token fallback is provided. Existing
MCP clients keep their protocol and credential behavior. `legacy: "stateless"`
remains mandatory under the [Cursor incident rule](incidents/2026-10-19-cursor-mcp-protocol.md).

## Primary references

- [RFC 8252](https://www.rfc-editor.org/rfc/rfc8252.html): native public clients,
  PKCE and loopback redirects.
- [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html): audience restriction,
  grant binding and refresh-token replay protection.
- [RFC 8628](https://www.rfc-editor.org/rfc/rfc8628.html): device authorization.
- [JOSE](https://github.com/panva/jose): standard JWT signing and verification.
- [Keyring](https://github.com/Brooooooklyn/keyring-node): native credential stores.
- [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html#data-to-exclude):
  exclude access credentials from logs.
