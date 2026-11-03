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

Get an MCP Token at https://apple-rag.com/mcp-tokens, then:

```sh
apple-rag auth login
apple-rag auth status --json
apple-rag upgrade
apple-rag auth logout
```

Login hides input and verifies the token before saving. In automation inject
`APPLE_RAG_TOKEN` from a secret manager, or pipe it to `auth login --token-stdin`.
Tokens are never accepted as command arguments. No model/Firecrawl/Stripe key is
needed. The server determines the plan on every request, including subscription
changes and expired one-time purchases. A rejected explicit token is an error,
never an anonymous fallback. `upgrade` prints the website pricing link.

Status reads identity, plan, remaining quota and reset times without consuming
retrieval quota. It can update credential last-used timestamps. Tool results also
include the account snapshot without another status request.

Saved tokens are bound to their exact endpoint in
`$XDG_CONFIG_HOME/apple-rag/credentials.json` (default `~/.config/apple-rag/`).
POSIX permissions: directory 0700, file 0600; Windows uses user-profile permissions.
`APPLE_RAG_CONFIG_DIR` overrides this directory. `APPLE_RAG_TOKEN` takes precedence,
even when empty/invalid. Logout removes the saved credential only: it does not
unset environment variables, revoke the server token or remove authorized-IP
access. Check `auth status` for the effective identity. Never share credentials.

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

Commands have a 45-second deadline and no automatic tool retries. Ctrl+C cancels
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

`apple-rag doctor --json` checks identity and MCP discovery without retrieval quota.
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

`APPLE_RAG_URL` selects a trusted custom MCP endpoint. HTTPS is required except on
loopback. Saved credentials for another endpoint are never forwarded; an explicit
environment token applies to the configured endpoint. Redirects are rejected.

This package contains compiled client code, manifest, README, license and skill.
Hosted corpus, database credentials and service configuration stay on the server.
Repository builds use pnpm; end users do not need it. Maintainers: see `ops/cli.md`
for the owner-operated first npm publication and subsequent OIDC automation.
