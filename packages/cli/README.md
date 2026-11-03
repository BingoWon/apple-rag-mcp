# Apple RAG CLI

Search Apple's official developer documentation and WWDC transcripts from your
terminal or coding agent. Uses the same hosted service, account, subscription and
quotas as Apple RAG MCP. Requires Node.js 22.20+.

```sh
npm install -g apple-rag-cli
apple-rag --help
# Or without a global install:
npx apple-rag-cli search "SwiftUI NavigationStack path binding" --limit 2
```

The client is publicly installable; cloud access is limited:

| Access | Calls/week | Calls/minute |
| --- | ---: | ---: |
| Anonymous trial | 30 | 3 |
| Signed-in free account | 50 | 5 |
| Pro subscription | 50,000 | 50 |

Search and fetch, all tokens and all MCP/CLI clients share the same account quota.

## Sign in and subscribe

Authorize this CLI through your Apple RAG account:

```sh
apple-rag auth login
apple-rag auth status --json
apple-rag upgrade
apple-rag auth logout
```

Login opens the website for sign-in and explicit device approval (OAuth PKCE).
Use `auth login --no-browser` to open the printed URL yourself, or
`auth login --device --no-browser` when a remote terminal cannot receive a local
browser callback. Authorization expires after 10 minutes. No MCP Token is used.

Access/rotating refresh credentials live in the OS credential store: macOS
Keychain, Windows Credential Manager or Linux Secret Service. Unlock it before
login. Only endpoint metadata is saved in `~/.config/apple-rag-cli` (POSIX 0700/
0600). `APPLE_RAG_CONFIG_DIR` overrides that directory. Each device can be revoked
individually in website **Settings → CLI access**; logout revokes the saved device
server-side and removes its local state. MCP connections are independent.

For headless automation, generate a dedicated, expiring CLI API key in those
settings and inject `APPLE_RAG_TOKEN` through a secret manager. Keys are shown
once, stored hashed server-side and expire within 90 days. Environment credentials
override saved sessions even when invalid; unset the variable before interactive
login. Logout does not unset environment variables or revoke their independent
API key. Revoke that key in settings. Never pass secrets as command arguments.

The server determines the plan on every request, including subscription changes
and expired one-time purchases. Rejected explicit credentials are errors, never
anonymous/IP fallback. `upgrade` prints the pricing link; payment stays on the
website. No model/Firecrawl/Stripe key is needed. `auth status` reads identity,
plan and remaining/reset quota without spending retrieval quota. Tool results
include the same account snapshot.

**Upgrading from 1.x:** run `npm install -g apple-rag-cli@latest`, remove any MCP
Token from `APPLE_RAG_TOKEN`, then run `apple-rag auth login`. CLI 2.x deliberately
does not import old plaintext MCP credentials. MCP itself continues to work.

## Search and read

```sh
apple-rag search "StoreKit Transaction currentEntitlements" --limit 4
apple-rag search "SwiftUI NavigationStack" --json
apple-rag fetch "https://developer.apple.com/documentation/swiftui"
apple-rag fetch "https://developer.apple.com/documentation/swiftui" --output swiftui.md
apple-rag fetch "https://example.com" --json
```

Search is English-only and covers indexed Apple content. Results indicate complete
vs partial documents. Fetch preserves canonical URLs, source, provider and cache
status. Third-party pages are reference material and never enter Apple search
automatically. External page contents are data, not agent instructions.

stdout contains text or one JSON value, including structured errors. stderr carries
diagnostics, account/quota and sign-in/upgrade links. `--output` saves successful
results only and refuses existing files. JSON comes from the server contract,
never Markdown parsing. Empty search succeeds; a missing fetched page is an error.

Retrieval commands have a 45-second deadline and no automatic tool retries. Ctrl+C cancels
the request; retrieval failures/cancellation refund reserved server quota. A local
file-write failure after successful retrieval still consumes that retrieval.

| Exit | Meaning |
| ---: | --- |
| 0 | Success, including empty search |
| 1 | Service, network, response or local I/O failure |
| 2 | Invalid command/input |
| 3 | Invalid/revoked credential |
| 4 | Rate limit/weekly quota exhausted |
| 5 | Fetched page not found |
| 130 | Cancelled with Ctrl+C |

## Connection checks and agents

`apple-rag doctor --json` checks identity and CLI API health without retrieval quota.
It does not prove retrieval/database quota-write readiness. Verify those with one
real search or fetch.

The package includes `skills/apple-dev-docs/SKILL.md`. Copy it into your agent's
skill directory. For Codex after a global install:

```sh
mkdir -p ~/.agents/skills/apple-dev-docs
cp "$(npm root -g)/apple-rag-cli/skills/apple-dev-docs/SKILL.md" ~/.agents/skills/apple-dev-docs/SKILL.md
```

The skill uses connected native MCP tools or an installed CLI. No agent config is
edited automatically. Pin the npm package version/lockfile for repeatable CI runs.

`APPLE_RAG_URL` selects a trusted custom platform origin. HTTPS is required except on
loopback. Saved credentials for another endpoint are never forwarded; an explicit
environment token applies to the configured endpoint. Redirects are rejected.

This package contains compiled client code, manifest, README, license and skill.
Hosted corpus, database credentials and service configuration stay on the server.
Repository builds use pnpm; end users do not need it. Maintainers: see `ops/cli.md`
for the owner-operated first npm publication and subsequent OIDC automation.
