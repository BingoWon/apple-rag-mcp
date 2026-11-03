# Admin log layout, historical dates and D1 write exhaustion

Recorded: 2026-11-03 (Asia/Singapore). Application release: 5.3.0.

## What failed

The admin fetch-log list was widened by a 2048-character synthetic URL from the
production MCP boundary audit. Its configured column widths were discarded by
`DataTable`; automatic table layout and unbounded content defeated truncation.
Deleting that row would leave the same defect for the next long URL or query.

A separate, more serious defect was introduced by 5.2.3 migration 0007. It copied
log tables with `INSERT INTO ... SELECT *`, assuming the physical column order in
0003 matched production. The historical production fetch table had `created_at`
before `country_code`, while the replacement table reversed them. All 7,198
historical fetch rows had timestamps in `country_code` and country codes/null in
`created_at`. Seven subsequent rows had the correct mapping. Search timestamps
were unaffected. This also broke time-based aggregates, ordering and country flags.

The previous incident report's matching row counts and selected content lengths
were insufficient to establish preservation of field meanings. Its local test
used the same schema order on both sides and missed the production difference.

Rebuilding both log tables and their indexes also incurred substantial D1 write
usage. D1 rejected the recovery migration with its free-plan daily row-write-limit
error. A live MCP fetch returned `isError: true` despite `/health` being healthy.
Quota reservations depend on D1 writes, so this was a production service incident,
not merely missing telemetry. The exact contribution of the migration to total
account-wide usage was not retrospectively measured; the missing write-budget
preflight was a release-process failure.

## Data recovery and verified service restoration

- Captured the pre-repair D1 Time Travel bookmark locally, outside Git.
- Replaced position-dependent copies in 0007 with explicit source/target columns.
  Existing installations do not rerun 0007; fresh installations get the safe copy.
- Added guarded migration 0008. It swaps only rows with an invalid timestamp,
  a valid timestamp in the country field and a country-shaped/null old date.
  It is repeatable and leaves correctly written new rows untouched.
- The owner upgraded the Cloudflare account after the platform rejected writes.
  The agent did not execute a payment or bypass quota/authentication.
- Applied 0008 successfully. Before/after: 7,205 fetch rows; invalid dates
  7,198 -> 0; dates in country field 7,198 -> 0; total URL field lengths
  1,080,535 unchanged. New rows were preserved. Regression tests compare every
  historical field under the actual legacy column ordering and repeat the repair.
- Live MCP fetch of SwiftUI and search for NavigationStack succeeded after the
  upgrade/repair, including their D1 quota reservations. A returned HTTP 200 alone
  is insufficient: check the MCP result's `isError`, expected content and logs.

## Admin implementation

Search/fetch lists share a typed table, query hook, filters, outcome badge and
Radix details panel. Column widths apply to actual `<col>` elements under fixed
table layout; the scroll container bounds both axes and pins the header. Primary
lists show time, request, outcome, duration and source/result count. Full content,
canonical URL, provider/upstream status, reason, cache, user and masked token are
available in the details panel with copy controls. Dates display explicitly in
UTC+8; legacy SQLite UTC dates and ISO dates share one parser. Invalid/missing
values display an em dash.

Narrow screens use cards instead of squeezing desktop columns. Customer contact
overlays are excluded from admin routes so they cannot cover list actions. Admin
navigation reuses the existing language/theme controls.

Filters are implemented in SQL over the full dataset, with matching count and
pagination predicates. Bound `INSTR` queries treat `%`, `_` and quotes literally
and support long URLs without D1's 50-byte LIKE pattern limit. Date filters use
UTC+8 day boundaries and normalize timestamps through `julianday`. Ordering has
an ID tie-breaker. Search details retain the complete stored query. Zero timings
remain zero. Fetch supports source, provider and cache filters.

Stale list requests are aborted. Pagination is reused by admin and dashboard
consumers; the zero-result next button is disabled. Shared dialogs and menus use
Radix for keyboard/focus/escape/collision behavior. The existing Tailwind/CVA,
icons and ApexCharts remain; no second styling system or unused table engine is
added. The implementation keeps the native semantic table for server-paged data.

## Verification and operational rules

- Regression tests cover column-order drift, safe/idempotent repair, historical
  UTC date parsing, zero values, long/literal SQL filters, counts, pagination,
  date boundaries, invalid parameters, authorization and full search details.
- `node --import tsx ops/ui/admin-fixture.mjs` serves a built UI and real admin API
  routes against isolated SQLite. Its synthetic password is `local-admin-test`;
  it binds only 127.0.0.1 and contains no production identities or credentials.
- Visual and keyboard checks exercise long URLs/queries, details/copy/escape/focus,
  filtering, empty results, pagination, narrow viewports, both themes/languages.
  The isolated fixture retained a 2,048-character URL and 9,908-character query in
  details. At 1280px, the page width remained 1280px with fixed table layout; at
  390px, the card list and full-width details panel stayed within the viewport.
  Copy preserved the full URL, Escape returned focus to the opener, and invalid
  date ranges displayed the validation error. Empty results disabled Next.
- Before a D1 schema/data migration: inspect actual production column metadata,
  record affected rows and Time Travel point, estimate data/index write work and
  verify plan/available write budget. Do not assume small table size means low
  write usage. Use explicit columns, transactional D1 migrations and a bounded,
  data-preserving recovery. Verify values and semantics, not just counts.
- Include a real MCP call in release acceptance. Liveness health is not proof of
  account/quota/database write readiness. Do not fail open on quota-write errors.
- Per the owner's policy, the existing GitHub repository was made private with
  history retained before source edits. HTTPS Git uses the existing authorized
  project credential; no third-party signup or identity grant was created.

## Release acceptance

- Source commit: [4e8f3a7](https://github.com/BingoWon/apple-rag-mcp/commit/4e8f3a7d3a4062108f3d6a8cc8f87904bf61cdc5).
- Local build and [GitHub CI](https://github.com/BingoWon/apple-rag-mcp/actions/runs/41579907077)
  passed lint, type checking, all 208 tests (zero skipped) and production builds.
  Existing bundle-size warnings remain outside this incident's scope.
- Cloudflare automatically deployed version `682bad69-eae3-40cb-9f3d-98ff358e4c3a`
  at 100% on 2026-11-03 04:46:10 UTC. No manual deployment was performed.
  `/health` returned 5.3.0 and [v5.3.0](https://github.com/BingoWon/apple-rag-mcp/releases/tag/v5.3.0)
  was created by the release workflow.
- The authenticated production admin session loaded the new six-column fetch
  list, UTC+8 dates, filters and details actions. Detailed filter/copy/focus and
  responsive checks used isolated fixture data, avoiding changes to user records.
- Post-deployment calls to `https://mcp.apple-rag.com` returned successful MCP
  results (`isError` absent/false) for SwiftUI fetch and NavigationStack search,
  with their expected document content. The new fetch also appeared in admin.
- Read-only D1 verification after those calls: 7,208 fetch rows, zero invalid
  dates and zero timestamps in country fields. No user rows were deleted.
- Production quota exhaustion/load tests and customer billing/message-send flows
  were not repeated. Workers Paid removes the free daily-write blocker; normal
  account quotas and usage billing still apply.
