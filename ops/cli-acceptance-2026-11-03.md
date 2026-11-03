# npm CLI acceptance — 2026-11-03

The initial public-package smoke test verified an isolated local npm installation,
version/help, doctor and one production fetch. This did not establish complete
terminal usability. This follow-up installs the published package with npm's
normal global installation path and exercises both `apple-rag` and `npx` against
`https://mcp.apple-rag.com`. No local source build substitutes for the npm package.

## Environment and installation

- macOS, Node 26.12.0, npm 11.20.0. Separate temporary global prefix added to PATH;
  empty user/global npm configs, fresh npm cache and separate CLI credentials.
  Normal install scripts are enabled. No browser automation or owner npm login.
- Commands, with `$PREFIX` denoting the temporary global installation prefix:

```sh
npm install --global --prefix "$PREFIX" --registry=https://registry.npmjs.org --no-audit --no-fund apple-rag-cli@1.0.0
apple-rag --version
apple-rag search "SwiftUI NavigationStack path binding" --limit 2
apple-rag fetch https://developer.apple.com/documentation/swiftui --output swiftui.md
npx --yes --registry=https://registry.npmjs.org --package=apple-rag-cli@1.0.0 apple-rag search "StoreKit Transaction currentEntitlements" --limit 1 --json
```

## Published 1.0.0: actual observations

25 checks: 24 passed, one failed. All retrievals below use production, not a fixture.
Timing is a single observation, not a benchmark or service guarantee.

| Scenario | Result | Exit / observation |
| --- | --- | --- |
| Official npm global installation | Pass | 14 packages installed in 11.14s |
| PATH command/version | Pass | 0; `1.0.0` |
| Help/onboarding | Pass | 0; search, fetch, auth, doctor documented |
| Anonymous account status | Pass | 0; anonymous plan and live quotas |
| Doctor | Pass | 0; discovery succeeds, weekly quota unchanged |
| Upgrade | Pass | 0; existing website pricing URL |
| Unknown command | Pass | 2; actionable argument error |
| Invalid result limit | Pass | 2; JSON `INVALID_ARGUMENTS` |
| Malformed explicit token | Pass | 3; `INVALID_TOKEN` |
| Well-formed but rejected token | Pass | 3; no anonymous fallback |
| Global human-readable search | Pass | 0; two results in 2.75s; NavigationStack source and partial marker; quota on stderr |
| Fetch to a new file | Pass | 0; 1,770-byte file in 2.06s, mode 0600, empty stdout |
| Existing output file | Pass | 1 in 0.15s; original file unchanged |
| Official npx JSON search | Pass | 0 in 4.36s; StoreKit result, complete flag and source URL |
| Anonymous minute limit | Pass | 4; `RATE_LIMIT_EXCEEDED`, HTTP-status field 429 and retry time |
| Real terminal hidden login | Pass | 0 in 1.20s; token never echoed, backspace editing works, saved mode 0600 |
| Keyboard Ctrl+C in login | **Fail** | **1; incorrectly reports `REQUEST_FAILED` and network troubleshooting** |
| Saved production account | Pass | 0; Pro, 50,000/week and 50/minute |
| Bad login while already signed in | Pass | 3; previous valid credential unchanged |
| Authenticated production search | Pass | 0 in 6.11s; two results and Pro account snapshot |
| Private IP URL | Pass | 2; `INVALID_URL` |
| Missing official page | Pass | 5 in 1.90s; Apple HTTP 404, `PAGE_NOT_FOUND` |
| Third-party fetch | Pass | 0 in 1.90s; example.com, `third_party`, Firecrawl, **cache hit**, 959 characters |
| Logout | Pass | 0; saved credential removed |
| Status after logout | Pass | 0; anonymous identity restored |

The production login used only the first-party MCP test token explicitly supplied
for production acceptance in this conversation. Tokens, emails, IP addresses,
account data and npm credentials are excluded from this report.

## Bug and minimal fix

Node readline emits a `SIGINT` event on its input interface when Ctrl+C is typed in
raw terminal mode. The CLI listened to the process signal only. Closing readline
therefore became a generic request error rather than cancellation. Forward the
readline event to the existing abort handler, retaining the same deadline and
cleanup. No protocol, billing, corpus or account-state change is needed.

Regression: a real POSIX pseudo-terminal types Ctrl+C at the hidden login prompt
and requires exit 130 plus `CANCELLED`, with no `REQUEST_FAILED` message. The helper
uses Python 3 supplied by Linux/macOS CI runners; end users need only Node.js.
Windows skips the POSIX terminal checks. Full local verification passes 213 main
tests and seven CLI tests. Service 5.4.1 / CLI 1.0.1 carries the fix.

Publication and a new npm-installed 1.0.1 terminal check must be verified after CI;
a passing local source test alone is not acceptance of the published fix.

## Coverage limits

- The example.com fetch exercised a cached third-party result; it does not prove
  a fresh Firecrawl request succeeds for arbitrary websites.
- Live account tests cover anonymous and the supplied Pro account. Free-account
  lifecycle, cancellation, expiry and quota sharing have isolated integration
  coverage; no real charge/subscription change was performed.
- Published-package terminal UX was tested on macOS. Linux/macOS/Windows source
  portability is checked in CI; Windows interactive Ctrl+C is not verified here.
