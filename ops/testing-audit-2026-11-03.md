# Test and CI value audit

Date: 2026-11-03. Scope: all 54 tracked test files, both GitHub workflows,
package scripts, CLI package verification and the UI review scripts. This is an
audit and disposition plan; the proposed test deletions and CI changes have not
been implemented.

## Finding

The test suite mixes service guarantees with mutable presentation decisions.
The failed assertion for `Copy Install Prompt` is an example: changing that
label to `Copy setup prompt` did not break copying, authorization or an API.
Updating that assertion made CI green but did not correct the testing policy.
Its literal-label check should be removed rather than maintained as a release
requirement.

There are 20 frontend test files / 1,618 lines, 27 Worker test files / 4,287 lines,
3 CLI test files / 655 lines and 4 operations test files / 316 lines. These are
source-size measurements, not measures of test value. A one-line assertion can
protect a real credential boundary; a long rendering test can protect nothing
beyond its current markup.

## What justifies an automated check

Keep a check when it verifies an externally meaningful behavior and a failure
would cause incorrect access, charges, data loss, wrong retrieval results,
broken client interoperability or failure to start/install. Check the result
through the actual shared implementation or protocol, not a second copy of its
logic. Existing incident regressions justify focused coverage.

Remove checks whose only purpose is to freeze a marketing sentence, CSS class,
color, logo count, section order, icon size or decorative placement. Review
visual changes on the relevant page at desktop and mobile sizes. A UI request
does not automatically justify permanent tests for its exact current appearance.
Do not replace deleted literal tests with another snapshot of the same markup.

A copy button has two different concerns: its wording is editorial; whether it
copies the intended MCP/CLI payload and selected credentials is functionality.
The latter deserves a small integration check. There is no need to repeat it
for every theme and viewport when those do not change the payload.

## Frontend disposition — every file

Paths below are relative to `src/`.

| File | Disposition | Reason / scope to retain |
| --- | --- | --- |
| `lib/auth-return.test.ts` | Keep | Reject external login-return URLs; actual redirect boundary. |
| `utils/adminDashboard.test.ts` | Trim | Keep unavailable-vs-zero and displayed numeric results; remove exact prose and link/label counts. Backend metric tests already cover aggregation. |
| `utils/adminDateTime.test.ts` | Keep | Historic D1/ISO inputs and UTC+8 conversion address real invalid-date behavior. |
| `utils/agentSetup.test.ts` | Remove text checklist | It checks command/phrase presence in a prompt, not successful agent setup. Cover payload identity in one copy smoke check and CLI operation in CLI tests. |
| `utils/assetRecovery.test.ts` | Keep | Recovery from missing bundles and prevention of reload loops affect application availability. |
| `utils/clipboard.test.ts` | Keep | Exact copied bytes, escaping and fallback are real behavior shared by credential/setup copying. |
| `utils/connectGuide.test.ts` | Remove | FAQ counts, topic wording and MCP-before-CLI prose belong to content review. |
| `utils/dashboardLinks.test.ts` | Consolidate | A working account entry/link is useful; combine route checks with one navigation smoke check rather than a separate documentation rendering suite. |
| `utils/form-controls.test.ts` | Keep narrow behavior | Radix slotted-link rendering, disabled loading state and label/error associations are component behavior/accessibility, unlike button wording. |
| `utils/heroStickers.test.ts` | Remove | Mostly freezes promotional assets, classes, wording and visual composition. Review actual Hero screenshots when it changes. |
| `utils/homepageSections.test.ts` | Remove | Freezes source order, carousel names/portrait counts and CSS implementation. The owner's design restrictions belong in change review. |
| `utils/jevMarketing.test.ts` | Split and greatly trim | Remove marketing text, logo counts, shadow expressions and sidebar positioning. Retain only a small metadata consistency/credential-free discovery check with metadata tests. |
| `utils/jevSection.test.ts` | Remove | Pins class strings, SVG geometry, colors and old copy exclusions; cannot establish that the page looks right. |
| `utils/mcpConfigService.test.ts` | Keep functional cases | Correct TOML/JSON, shell quoting, UTF-8 URI encoding, selected token/URL and anonymous access are machine-consumed contracts. Drop logo inventory/ordering checks. |
| `utils/mcpInstallButtons.test.ts` | Remove literal/structural checks; consolidate remainder | Drop wording, icon sizes, exact button/image counts and disclosure placement. Keep actual selected-payload/copy behavior in one integration check, without duplicating config generation tests. |
| `utils/releaseVersion.test.ts` | Keep or make a release preflight | Package and MCP manifest versions must match. Eight lines with a concrete release failure to prevent. |
| `utils/sidebar.test.ts` | Remove visual test; optional preference smoke | Color/class assertions have no release value. Saved preference behavior is low risk and can be covered while reviewing navigation. |
| `utils/siteMetadata.test.ts` | Keep privacy/routing; trim editorial checks | Keep auth parameters out of canonical/JSON-LD, safe serialization, private-page indexing and correct route handling. Do not freeze titles or marketing phrases. |
| `utils/skillDoc.test.ts` | Remove prose/style checks | Custom frontmatter parsing, exact sentences, arbitrary line limits and a prohibition on a README do not demonstrate agent usefulness. Retain bundled-file presence in the package verification that already exists. |
| `utils/supportedClients.test.ts` | Remove presentation assertions | Counts, order, logos, headings, rendered price markup and quota prose duplicate content/config. A link/asset smoke review and the copy functionality check are sufficient. |

## Worker disposition — every file

Paths below are relative to `worker/`. Retain behavior, not incidental error
prose or arbitrary internal call ordering. A protocol error code/status is a
contract; its explanatory English sentence usually is not.

| File | Disposition | Consequence protected |
| --- | --- | --- |
| `api/routes/admin-logs.test.ts` | Keep | Query filtering, full long inputs, input rejection and credential-safe channel logs. |
| `api/routes/admin-stats.test.ts` | Keep | Admin access, time boundaries, real counts and honest handling of database failure. |
| `api/routes/stripe.test.ts` | Keep but recognize limited coverage | Subscription status mapping only; this is not proof of payment/webhook correctness. |
| `collector/AppleAPIClient.test.ts` | Keep | A 403 or missing JSON must not authorize permanent corpus deletion. |
| `collector/AppleDocCollector.test.ts` | Keep | Failed discovery must remain retryable and must not corrupt collection state. |
| `collector/EmbeddingProvider.test.ts` | Keep | Bounded batching, ordering and overloaded-provider recovery. |
| `collector/PostgreSQLManager.test.ts` | Keep integration scenarios | Concurrency, rollback, deduplication, lost acknowledgements and interrupted writes protect collected data. |
| `collector/hls-subtitles.test.ts` | Keep parser/download cases | Valid Apple video paths, segmented captions and readable transcript output. |
| `mcp/access-guidance.test.ts` | Trim | Keep quota values, status and nonnegative retry times. Drop exact upgrade/recommendation prose. |
| `mcp/account.test.ts` | Keep | Account errors must not become anonymous access or public cache entries. |
| `mcp/auth.test.ts` | Keep | Invalid explicit tokens cannot fall back to IP authorization; secrets remain private. |
| `mcp/cancellation.test.ts` | Keep | Cancellation propagation and quota refund only after a reservation. |
| `mcp/http.test.ts` | Keep endpoint contracts | Origin rejection, request size, supported protocol handshakes and cancellation configuration. |
| `mcp/protocol-handler.test.ts` | Keep contracts; trim incidental constants | Modern/legacy behavior, tool schemas, auth rejection and service cleanup. Do not pin arbitrary cache durations or fixture prose without a contract reason. |
| `mcp/response-formatter.test.ts` | Keep | Correct source attribution and complete-vs-partial document reporting. |
| `services/database.test.ts` | Keep real SQL | Cache expiry, alias integrity, paid-provider budget races and indexing admission. |
| `services/embedding-fallback.test.ts` | Keep | Provider fallback, dimensions and cancellation behavior. |
| `services/log-migrations.test.ts` | Keep | Preserve historical rows, repair known timestamp defects and prevent bearer-secret logging. |
| `services/page-reader.test.ts` | Keep | Official JSON/fallback, true 404s, third-party provenance, budget limits, SSRF boundaries and cancellation. |
| `services/rate-limit.test.ts` | Consolidate with actual-SQL coverage | Its fake database simulates the quota SQL and calls the service sequentially; it does not prove the claimed SQL atomicity. Preserve business cases in real-SQL integration tests rather than maintaining duplicate SQL behavior in a fake. |
| `services/reranker.test.ts` | Keep | Score/document alignment, fallback and cancellation; avoid incorrect search rankings. |
| `services/search-engine.test.ts` | Keep | Do not merge different URLs; retain useful results when a provider fails. |
| `services/tool-call-logger.test.ts` | Keep | Actual SQL verifies outcomes, accounting/refunds, provenance and migration safety. |
| `shared/postgres-retry.test.ts` | Keep | Retry only transient errors and stop within a bounded policy. |
| `shared/telegram.test.ts` | Keep bounded behavior | Redact credentials and bound alert retries/coalescing; no need to freeze message prose. |
| `shared/url-utils.test.ts` | Keep | Apple URL canonicalization influences duplicate records and retrieval. |
| `shared/web-url.test.ts` | Keep | URL identity, private-address rejection and streamed response limits. |

## CLI and operations disposition — every file

| File | Disposition | Reason |
| --- | --- | --- |
| `packages/cli/test/cli.test.ts` | Keep end-to-end behavior; trim display prose | Login/save/revoke, shared quotas, secret handling, cancellation and file no-clobber behavior affect users. |
| `packages/cli/test/oauth.test.ts` | Keep | PKCE, one-time codes, refresh replay, device approval and CLI/MCP credential isolation are essential service boundaries. |
| `packages/cli/test/login-page.test.ts` | Trim | Keep hostile URL escaping and credential-safe output; remove decorative markup/motion expectations. |
| `ops/cli/npm-release.test.mjs` | Keep at release-tool changes | Prevent unintended npm publication or publishing after a registry failure. |
| `ops/cli/wait-for-service.test.mjs` | Keep at release-tool changes | Prevent shipping a CLI before its required API is deployed. |
| `ops/collector/postgres-socket.test.mjs` | Keep for transport changes | Bounded writes and complete packets protect database data. |
| `ops/jev/evaluate.test.mjs` | Run for evaluation-tool changes | Useful for the offline evaluation utility and query privacy; not necessary for every website copy change. |

## CI and manual review costs

`package.json` has `prebuild: pnpm verify`: an ordinary build runs lint, type
checking, all application tests and CLI tests. The GitHub `check` job runs this
build with PostgreSQL, then packs and installs the CLI into an isolated consumer.
Two additional jobs install/build/test the CLI on macOS and Windows for every
push/PR, even if only homepage copy changed. The npm job also starts on every
successful main build and checks whether publication is needed. The version gate
prevents duplicate npm publication, but does not avoid the preceding irrelevant
work. A literal marketing assertion can block the release workflow because it
depends on the result of the whole CI workflow.

Recommended scope:

- Keep build/type/lint as basic validity checks for affected code.
- Run core behavior checks when their code, shared contracts, dependencies or
  build configuration change. Do not gate a text-only change on unrelated CLI OS
  jobs or collector database integration.
- Run CLI package/install and macOS/Windows checks for CLI, its shared server/auth
  contracts, packaging or dependency changes, and before a CLI release.
- Keep npm publication gates on actual CLI releases.
- Use a small desktop/mobile visual review for a UI change. Broader language,
  theme or platform matrices belong to changes that actually affect them.
- Retain an explicit full-check command for broad changes or release confidence;
  full verification need not be attached to every build invocation.

Dependency changes must broaden the affected checks. A naive CLI-directory-only
filter would miss shared authorization changes, so path selection needs to cover
the actual shared contracts, not just the CLI package directory.

The five `ops/ui/check-*.mjs` browser scripts are manually invoked, not GitHub CI
steps. They overlap substantially. `check-agent-brand.mjs` and
`check-connect-layout.mjs` both inspect copy actions and layout;
`check-jev-copy.mjs` preserves older presentation expectations.
Consolidate useful navigation/copy/auth smoke behavior, remove fixed CSS/geometry/
marketing assertions and use optional screenshots for visual review.
`check-site-metadata.mjs` should retain privacy/header/SPA-transition checks.
`check-cli-auth.mjs` should retain a minimal authorization interaction, with
security branches covered by the OAuth suite. `admin-fixture.mjs` supplies preview
data and `render-og-image.mjs` generates an asset; neither is an independent test
suite to delete merely for being in `ops/ui/`.

The previously reported “150 browser checks” counts combinations, screenshots and
steps across languages, themes and widths. It is not 150 independent business
guarantees and should not be presented as a quality score.

## Coverage limits matter more than test counts

- Stripe has only a status-mapping unit test in this inventory; webhook signature
  validation and duplicate-event entitlement handling exist in production code
  but are not established by that test. UI label tests do not compensate for this.
- CLI child-process tests replace `@napi-rs/keyring` with a temporary-file vault.
  Their macOS/Windows success does not establish that the native credential vault
  works on an actual user's machine. Keep this limitation explicit.
- Local verification without `TEST_DATABASE_URL` skips PostgreSQL integration
  scenarios. For this UI release, local output was 210 passed / 3 skipped at the
  top level; CI, with PostgreSQL and nested cases, was 229 passed / 0 skipped.
  Both also ran 16 CLI cases. These should not be described as identical runs.
- The CLI shared-minute-quota test uses multiple real child processes and the
  real clock. It can cross a minute boundary. Preserve the accounting scenario
  but control its clock/window rather than weakening the expected quota or
  relying on repeated CI attempts.

The desired outcome is fewer checks tied to implementation details and a small,
trustworthy set of checks for actual service guarantees. This audit does not
justify deleting authorization, billing, data-integrity or protocol coverage.
