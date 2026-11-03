# CLI operations and npm publication

Current implementation: service 5.5.2, independent npm `apple-rag-cli` 2.0.0;
executable `apple-rag`, Node.js 22.20+. See [authorization architecture](cli-auth-architecture.md)
and [acceptance](cli-auth-acceptance-2026-11-03.md). The CLI uses a versioned JSON
API and independent OAuth/device/API-key credentials, with shared account billing
and quotas. CLI 1.x MCP-token login is intentionally unsupported in 2.x.

TypeScript is bundled with the repository's existing Vite. Runtime dependencies
are Zod and the native OS vault package; no MCP SDK, CLI framework or separate
retrieval backend. Contracts live in `shared/contracts.ts`. Files in the npm
archive are strictly limited to manifest, README, LICENSE, `dist/cli.js` and the
agent skill. Service secrets/configuration and fixture adapters are excluded.

Build and validate before pushing main:

```sh
pnpm install --frozen-lockfile
pnpm build
node --import tsx ops/cli/verify-package.mjs
```

`pnpm build` includes lint, types, PostgreSQL/unit checks and HTTP/SQLite CLI
integration tests. Tests mock only the OS vault in child processes; authorization,
PKCE/device consent, refresh/replay, quota, HTTP routing and SQL execute real code.
The distributable check packs and clean-installs the actual archive, then invokes
its real binary and independent CLI API. CI covers Linux/Node22, macOS/Node24 and
Windows/Node26; POSIX signal tests are skipped on Windows. Production acceptance
also uses a fresh public npm install and the real macOS vault.

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
Before publishing a new CLI, CI waits for the matching production service version
and independent CLI API health. A failed deployment cannot release an unusable client.
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

Homebrew, standalone binaries, agent-config editing and bulk
crawls are deferred. The private repository's releases are not public binary
downloads. No same-task token/performance/cost benefit over MCP is claimed.

Detailed npm installation and production UX acceptance, including the keyboard
cancellation bug found in 1.0.0 and the 1.0.1 fix, is recorded in
[CLI acceptance](cli-acceptance-2026-11-03.md).
