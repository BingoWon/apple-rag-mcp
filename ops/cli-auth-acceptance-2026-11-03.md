# CLI 2 independent authorization acceptance — 2026-11-03

## Local verification

- Full lint, TypeScript, 218 application/PostgreSQL tests and 14 CLI HTTP/SQLite tests
  pass. CLI tests cover real PKCE and device consent, login denial and cancellation,
  refresh rotation/replay, expiry/revocation, cross-resource rejection (including
  stripped JWT prefixes), shared paid/free quotas, refund/cancellation, invalid
  input, output-file protection and log attribution with spoofed headers.
- The npm artifact contains exactly five allowlisted files. It is packed,
  clean-installed and invoked as the real `apple-rag` executable against the
  independent API fixture, with no MCP client dependency or owner npm login.
- Actual native macOS Keychain write/read/delete passed with a fresh test entry.
  HTTP integration tests use a test-only vault adapter not included in the archive.
- Browser UI automation was not used, as requested. Website source/type/build and
  authorization HTTP behavior are checked; visual interaction is not claimed.

## Production cutover

- Before migration: 18,769 search rows (11,109 with non-null old token field),
  7,236 fetch rows (3,703 with non-null old token field). No secret values were
  exported. The pre-change D1 Time Travel bookmark is retained in private evidence.
- Only 0009 was pending; it applied successfully (26 SQL commands, 335.69 ms).
  It adds CLI authorization state/context, clears old log secrets and installs
  temporary scrub triggers for the old Worker. Post-migration counts are unchanged and both raw-token counts are zero. No corpus migration or log-table
  rebuild is involved. The owner had already upgraded the Cloudflare account.
- Service deployment, public npm 2.0.0 install and final column removal are pending
  at this checkpoint; update this section after observing production results.

## Deployment checks

The first CI run passed Linux/application checks and macOS but blocked npm release
on a Windows test-loader path: Node ESM requires a file URL for the `--import`
hook. The fixture invocation now uses `URL.href`; no product authentication
fallback is added. The first Cloudflare build also failed, leaving 5.4.1 live at that time.
A subsequent automatic build succeeded and production now serves 5.5.0. The cause
of the first build failure was not established.
The existing Wrangler OAuth token lacks Workers CI read scope, so its build-log
API returned 403. No broader account authorization or browser login was attempted.

CLI tool responses also keep cleanup/refunds alive through Worker `waitUntil`
after disconnect; cancellation is not reported as a service outage.

The user-facing usage-history API also read the old secret column; 5.5.1 changes
its contract/UI to channel and credential references, fixes combined SQLite history
queries and includes non-500 4xx errors in history filters. npm publication now
waits for the matching deployed service and CLI API, after full CI checks.

## Limits

No real subscription/charge is created or changed; paid lifecycle checks use
isolated fixtures. Test authorization must use a temporary first-party account,
never the owner's login or supplied MCP token. Historical backups can contain old
log secrets under provider retention; SQL cleanup affects the live application
rows. No claim of authenticating the owner's personal CLI session is made.
