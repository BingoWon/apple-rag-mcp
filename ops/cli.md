# CLI design, authentication and npm publication

Decision: 2026-11-03. Service 5.4.1; npm package `apple-rag-cli` 1.0.1;
executable `apple-rag`. The owner completed first publication and Trusted Publisher
setup. Public registry access and a clean installation have been independently
verified. Package: https://www.npmjs.com/package/apple-rag-cli.

The current CLI uses MCP credentials and transport. A proposed separation of CLI
authorization, API entry and request-channel logging is documented in
[authorization boundaries](cli-auth-architecture.md); it is not implemented yet.

## Architecture and authentication

- TypeScript compiled to Node.js 22.20+ JavaScript; official MCP client 2.3.1, Zod
  and Node built-ins. Independent public client package in the private monorepo;
  root `private: true` remains. No CLI framework or separate retrieval backend.
- Shared contracts in `packages/cli/src/contracts.ts` validate Worker and client
  input, structured results and account status. MCP keeps readable text and
  `legacy: "stateless"`; CLI opts into SDK auto negotiation. Object-root output
  schemas work across both protocol eras. No Markdown parsing or corpus migration.
- Search preserves completeness/chunks; fetch preserves requested/canonical URL,
  source, provider, cache and upstream status. External pages never enter RAG
  automatically. JSON errors distinguish invalid input, missing pages and limits.
- Anonymous 30/week, 3/minute; free hobby 50/week, 5/minute; Pro 50,000/week,
  50/minute. The client is free to install; cloud usage is the subscription product.
  Every token and MCP/CLI client for one user shares the same usage counters.
- `GET /account` on the MCP host (`/mcp/account` on the website) reuses MCP Token/IP
  auth and reads existing subscriptions/counters. `Cache-Control: no-store`;
  no retrieval quota consumed. Auth may update last-used timestamps. Responses
  expose effective identity/method, plan, quota/reset times and login/upgrade URLs,
  never tokens. Successful/limited tool results include the same quota snapshot.
- Login validates before atomically replacing owner-only, endpoint-bound stored
  credentials. Environment credentials take precedence. Invalid/revoked explicit
  credentials never fall back to saved/IP/anonymous access. Logout removes the
  local token, not environment credentials, server tokens or authorized-IP access.
- Entitlements remain server-controlled, including upgrades, cancellation and
  expired one-time purchases. Payment stays on the existing website. Status/login/
  discovery cost no retrieval quota. Failures/cancellation keep current refunds.
  No automatic tool retry. stdout is data; stderr is diagnostics/quota/guidance.

## Build and inspect

```sh
pnpm install --frozen-lockfile
pnpm build
mkdir -p /tmp/apple-rag-cli-release
cd packages/cli
npm pack --ignore-scripts --pack-destination /tmp/apple-rag-cli-release
tar -tzf /tmp/apple-rag-cli-release/apple-rag-cli-1.0.0.tgz
```

Only manifest, README, LICENSE, `dist/*.js` and the skill are allowed. Never publish
the root package. CI verifies this allowlist and clean-install help/version from
the actual tarball. Fixture tests exercise actual HTTP, MCP SDK, Worker handlers
and SQLite: three tiers, subscription upgrades/cancellation/expiry, quota sharing,
credential rejection/priority/binding, no secret echo, status/discovery, provenance,
empty results, HTTP-200 tool errors, refunds, no-clobber output and POSIX cancellation.
Portability checks cover Linux/Node22, macOS/Node24 and Windows/Node26.

## Owner-operated first npm publication

The owner requested no browser automation, has an npm account, and explicitly
chose to perform login/publication personally. The agent prepares and verifies
the artifact but does not use the owner's npm identity. In the owner's terminal,
paste this block; `&&` stops if a step fails. Complete npm login and any 2FA prompts
personally. The final command configures future releases without a settings form:

```sh
npm login &&
npm publish /tmp/apple-rag-cli-release/apple-rag-cli-1.0.0.tgz --access public --provenance=false &&
npm trust github apple-rag-cli --repo BingoWon/apple-rag-mcp --file ci.yml --allow-publish --yes
```

The installed npm 11.20.0 supports `npm trust` (requires 11.15.0+). Account-level
2FA must be enabled for trusted publishing; if npm asks to enable it, that account
security step remains owner-operated. No password/OTP/access token belongs in chat.
After the owner completes these operations, the agent can verify public registry
availability and a clean install without account access:

```sh
npm view apple-rag-cli@1.0.0 version dist.integrity
npx --yes apple-rag-cli@1.0.0 --version
```

Publish only the inspected/tested tarball from the delivered commit. If the name
belongs to someone else, stop and use an owned scope/name, updating metadata/docs/
workflow first. Never overwrite/unpublish another release or bypass 2FA/legal gates.

## Subsequent automatic publication

The `npm trust github` command above binds package `apple-rag-cli` to repository
`BingoWon/apple-rag-mcp`, workflow `ci.yml`, with publish permission and no named
environment. Its arguments were checked against the installed npm help and with
`--dry-run --yes`; the owner then ran the real command personally and supplied its
successful result. The returned permissions were `publish, stage publish`, even
though only `--allow-publish` was passed. CI uses direct publish only. The agent did
not read or change the owner's authenticated trust settings. The equivalent npm
Settings → Trusted publishing → GitHub Actions form remains an optional fallback.

The CI publish job runs only on main pushes after checks/portability succeed.
GitHub-hosted runners use OIDC (`id-token: write`), without a long-lived npm token.
Missing package: record the owner bootstrap step and skip. Existing exact version:
skip. New version of an existing package: publish through the trusted workflow.
Registry/network/publish errors fail CI rather than masquerade as a missing package.

Increment the independent CLI version for CLI/shared-contract/bundled-skill changes.
Keep root/server versions synchronized under existing release rules. Server-only
changes need no npm update or user reinstall. npm provenance is disabled because
private GitHub repositories currently cannot generate it; OIDC still works.

References: [npm metadata](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/),
[Trusted Publishers](https://docs.npmjs.com/trusted-publishers/),
[MCP structured output](https://ts.sdk.modelcontextprotocol.io/v2/clients/calling).

## Release verification — 2026-11-03

- Implementation commit: `501b79d93011963927c5996a72f1d70fb04a449c`;
  [service release 5.4.0](https://github.com/BingoWon/apple-rag-mcp/releases/tag/v5.4.0).
  Main push deployed through Cloudflare Workers Builds; no manual deployment.
- [CI](https://github.com/BingoWon/apple-rag-mcp/actions/runs/41590038216) passed:
  lint, types, 213 main tests, six CLI integration tests, production build and
  isolated tarball install/discovery/retrieval. macOS/Node24 and Windows/Node26
  passed too; the POSIX signal/refund test is intentionally skipped on Windows.
- Production `https://mcp.apple-rag.com` reports 5.4.0. Anonymous account/status
  and doctor succeeded with unchanged weekly quota. Real CLI search returned an
  indexed Apple result with partial-document metadata; SwiftUI fetch returned
  indexed Apple content. Legacy `initialize` with `2025-06-18` returned HTTP 200
  and that protocol revision. Subscription lifecycle/paid quota changes were
  tested with isolated fixture data, without real charges or subscription edits.
- Tested owner publication artifact:
  `/tmp/apple-rag-cli-release/apple-rag-cli-1.0.0.tgz`, SHA256
  `b60d8af9ef784612fdb0777e9faae2f3ccea79fee31eb8ca162c888f67be60ba`.
  Ten allowlisted client files only; no credentials, service config or private data.
  CI also retains the verified package as the `apple-rag-cli` artifact.
- Before the owner's bootstrap, npm registry returned E404 and the first CI
  correctly skipped publication. No npm login,
  account creation, owner-identity authorization or npm publication was performed
  by the agent.

## Public npm verification — 2026-11-03

- The owner supplied successful output for login, `+ apple-rag-cli@1.0.0`, and
  GitHub trust creation for `BingoWon/apple-rag-mcp`, workflow `ci.yml`.
- Anonymous registry lookup and tarball download succeeded. Registry SHA1 was
  `589883fcda16532e2a7196bb8571d2f713d5493c`; SHA512 integrity was checked. The
  downloaded tarball matched the previously tested artifact byte-for-byte
  (SHA256 above).
- Installed `apple-rag-cli@1.0.0` from the public registry in a temporary consumer
  with empty user/global npm configs, a fresh cache, no npm token, no Apple RAG
  token and no saved client credentials. Version/help, quota-free doctor and a
  production SwiftUI fetch succeeded; fetch returned indexed Apple content.
  Temporary installation/config/cache were removed. The owner's login was not
  used or changed.
- An npm organization is not required for the unscoped `apple-rag-cli` package.
  Organizations provide team management and an organization namespace such as
  `@apple-rag/cli`; this would be a distinct package name. Public client
  distribution does not change cloud account/subscription enforcement.
- Trusted Publisher creation was confirmed by owner output. A real OIDC upload
  subsequently published the 1.0.1 cancellation fix through CI, followed by 17
  successful npm-installed acceptance checks; see the detailed report below.

## Scope limits

Homebrew, standalone binaries, browser/device login, agent-config editing and bulk
crawls are deferred. The private repository's releases are not public binary
downloads. No same-task token/performance/cost benefit over MCP is claimed.

Detailed npm installation and production UX acceptance, including the keyboard
cancellation bug found in 1.0.0 and the 1.0.1 fix, is recorded in
[CLI acceptance](cli-acceptance-2026-11-03.md).
