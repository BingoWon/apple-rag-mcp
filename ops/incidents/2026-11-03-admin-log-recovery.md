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
  Final production verification is recorded after automatic deployment.
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
