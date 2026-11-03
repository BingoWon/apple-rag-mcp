# CLI 2 independent authorization acceptance — 2026-11-03

## Delivered behavior

See [the implemented architecture](cli-auth-architecture.md) for grants, scopes,
OS-vault storage, service boundaries and migration order.

CLI 2.0.0 is publicly available on npm through GitHub OIDC. Service 5.5.1 was
verified on production with the final D1 schema. The 5.5.2 release records that
schema cleanup and its regression coverage. CLI and MCP have independent
credentials/API entries and share platform account subscriptions and quotas.

## Local and CI verification

- Full lint, TypeScript, 218 application/PostgreSQL tests and 14 CLI HTTP/SQLite
  tests pass. The final schema also passes targeted migration, real log-writer,
  admin-filter and CLI integration checks. Authorization, PKCE/device consent,
  refresh/replay, HTTP routing and SQL execute real implementation code; only the
  OS vault in child-process integration tests is replaced by a test-only adapter.
- [CI 41604212364](https://github.com/BingoWon/apple-rag-mcp/actions/runs/41604212364)
  passed Linux/Node22, macOS/Node24 and Windows/Node26 checks, isolated distributable
  installation and OIDC publication. POSIX terminal/signal tests are skipped on
  Windows. Five npm files are allowlisted; fixtures, private config and secrets
  are excluded. The CLI has no MCP client dependency.
- Actual native macOS Keychain write/read/delete passed. Production npm-installed
  login and refresh below also used the real OS vault.
- New publication waits for the matching deployed service version and independent
  CLI API health; a failed deployment cannot release a new client prematurely.

## Official npm installation and production acceptance

A fresh public-registry global installation into a temporary prefix and a separate
fresh-cache `npm exec --package=apple-rag-cli@2.0.0` both report 2.0.0. Empty user
and global npm configs were used; the owner's npm login was never used. The
public archive matches the registry SHA512 integrity and the exact CI-tested
artifact byte-for-byte. Its SHA256 is
`2be1d895d2f744078d1d706433f0bf4259b98aaf8f7e546e385cf467194dd75a`.

46 production assertions passed against `apple-rag.com` / `mcp.apple-rag.com`:

- A temporary first-party test account with a reserved `.invalid` address signed
  in through the normal password API, then explicitly approved CLI grants through
  website authorization APIs. No owner's identity, supplied MCP token or browser
  session was used. The automated phase did **not** sign the owner into their own CLI.
- Both PKCE loopback and device-code login completed using the npm binary and
  real Keychain. A wrong callback state was rejected. Files contained endpoint
  metadata only. Account/status/doctor consumed no retrieval quota.
- Real CLI search and indexed Apple fetch succeeded. Legacy and modern MCP calls
  using a separately issued test MCP token consumed the same user's weekly quota:
  four successful operations across the two entries reduced 50 to 46.
- MCP and website credentials were rejected by the CLI resource; CLI keys were
  rejected by MCP and website management. An expiring automation key had its own
  authentication method and became unusable immediately after revocation.
- Forcing only the test vault's local access expiry caused a real server refresh
  and vault rotation. Replaying the old refresh credential revoked that device's
  still-unexpired access, while its MCP credential remained valid. Both browser
  and device sessions were logged out and removed from the vault.
- After old-column removal, production user history returned CLI search/fetch and
  MCP fetch rows with the expected request/credential IDs and no bearer field.
  The authorization SPA route returned HTTP 200. Cursor-style `initialize` with
  `2025-06-18` still succeeded.

Production Admin rejected the local **development** password with HTTP 401. No
production management credential was changed or recovered. Authorized admin
channel filtering is verified by the real HTTP/SQLite fixture; production data
attribution is checked through the test user's history and direct D1 queries.
A production Admin login/filter session is not claimed.

## Owner-operated browser login verification

On 2026-11-03, the official npm CLI 2.0.0 was installed globally using empty npm
user/global configs. The CLI started its normal PKCE browser login. The owner
personally signed in and approved the device in the website, then confirmed that
approval in chat; no consent API shortcut or pasted MCP token was used for this
phase. The CLI received the loopback callback and reported OAuth authentication
with the existing Pro entitlement.

Independent `auth status` and `doctor` checks passed. One real CLI search returned
Apple documentation and consumed exactly one weekly quota unit. The owner-approved
session remains in the native credential store for normal use. No personal email,
password, access token or refresh credential is recorded in this report. Browser
login interaction is now verified with owner participation; broader visual UI
acceptance and production Admin login remain outside these checks.

## D1 cutover

- Before 0009: 18,769 search rows (11,109 with a non-null old token field), 7,236
  fetch rows (3,703 with a non-null old field). No secret values were exported.
  Private evidence retains the pre-change D1 Time Travel bookmark.
- 0009 applied successfully: 26 commands, 335.69 ms. Row counts were unchanged,
  old token fields became null, and temporary triggers scrubbed old Worker writes.
  Historical channels remain `unknown`; surviving credential IDs were mapped
  without guessing which client used a shared token.
- Production 5.5.1 was checked before 0010: the remaining user-history reader was
  replaced, combined history SQL worked, and only the two temporary triggers still
  referenced the obsolete columns. A fresh bookmark/count check was retained.
- 0010 applied successfully: 5 commands, 39.95 ms. Both secret columns and scrub
  triggers are removed. Existing rows and indexes are preserved; live test calls
  successfully write/read their new metadata. No PostgreSQL corpus change or
  hand-written table-copy migration was performed. SQLite may rewrite storage
  for DROP COLUMN; the already-upgraded Cloudflare account covers these writes.
- After 0010, do not roll the Worker back before 5.5.1 without a matching schema
  recovery. Prefer a forward fix. Historical backups can retain old secrets under
  provider retention; live-table cleanup does not erase every backup.

## Issues found and limits

The first Windows test run failed because Node ESM requires a file URL for the
`--import` fixture hook. Using `URL.href` fixed it, and Windows CI passed. The first
Cloudflare build failed without changing the live service; the subsequent automatic
build succeeded. Its initial cause was not established. The current Wrangler
OAuth token lacks Workers CI log-read scope (HTTP 403); no broader authorization
or browser login was attempted.

No real subscription or charge was created/changed; paid lifecycle tests use
isolated fixtures. Browser UI automation was not used, as requested. Website
source/types/build and authorization HTTP behavior are checked; visual interaction
is not claimed. Temporary account/grants/keys, test log/counter rows, native vault
entries were verified removed; temporary installation/config/cache files are
removed after final deployment checks.
