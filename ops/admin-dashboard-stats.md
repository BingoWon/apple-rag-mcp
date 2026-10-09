# Admin Dashboard Statistics

The admin homepage uses the installed
[ApexCharts](https://github.com/apexcharts/apexcharts.js) charts and the existing
period selector. No new package or schema migration is required.

- Six trends count records created within the selected window: users, tokens,
  authorized IPs, search calls, fetch calls, and contact messages.
- Search and fetch use stacked bars for success (`200`), rate limits (`429`),
  other known status codes, and unknown historical statuses. All seven detail
  pages remain accessible.
- The paid-user panel is a current snapshot of active Pro and Enterprise
  entitlements, excluding expired one-time packages. It does not claim historical
  subscription growth and does not change with the selected date range.
- `GET /api/admin/stats` uses the existing admin password middleware, returns
  counts only, and disables response caching. Six aggregations and the paid-user
  snapshot run in one read-only database batch.
- All boundaries and chart labels use Singapore time. The 24h window is rolling
  and grouped by hour; 7d and 30d include today and use calendar days. Custom
  dates include both selected dates, allow at most 90 days, and cap today at the
  request time. Missing buckets are zero-filled.
- Date-prefix predicates preserve existing log indexes; exact comparisons
  accept both ISO timestamps and older SQLite timestamps.
- A new request aborts the previous request. Loading/failure states show
  placeholders, not fabricated zeros. The charts load lazily and disable
  animation. The two request charts retain native zoom and export tools.

Tests run the actual aggregation SQL against an in-memory SQLite database using
repository migrations, including authentication, calendar boundaries, mixed
timestamp formats, status accounting, subscription expiry, query index use,
empty buckets, and failures. Render checks cover both languages, placeholders,
zero counts, and all detail links.

The totals describe persisted records, not unique visitors or all HTTP traffic.
Deleting records changes historical counts; asynchronous logging failures can
leave gaps. No production records are changed by these statistics.
