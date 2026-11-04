# Admin MCP / CLI statistics

The overview compares MCP, CLI, and unknown request sources in one trend chart.
Counts include recorded search and fetch attempts, including rate limits and failures;
they are not counts of successful retrievals or billable usage. Each source shows its
share of all recorded calls in the selected period. Unknown history is never relabeled
as MCP. The unknown series is hidden only when its count is zero.

`GET /api/admin/stats` accepts `channel=mcp|cli|unknown`. The filter applies to the
search and fetch metrics and their outcomes. The source comparison always includes
all sources. User, active-user, token, IP, message, and subscription statistics remain
global; accounts and subscriptions are shared across access methods. Search and fetch
aggregation groups by time bucket and channel in the existing queries, without an
additional scan for the comparison chart.

Search and fetch detail links carry `channel`, `from`, and `to`. Exact timestamps use
the half-open interval `[from, to)`, including rolling 24-hour ranges. Log filters are
stored in the URL and survive reloads. Applying another filter retains the exact
interval; entering calendar dates replaces it, and Reset clears all filters. Exact
timestamps cannot be combined with calendar `start` / `end` parameters. Calendar
dates and chart buckets retain the existing UTC+8 convention.

## Verification

- SQL-backed route tests cover source totals, outcomes, unknown history, unchanged
  account/subscription statistics, zero-filled buckets, and exact time boundaries.
- Log route tests cover source filtering and invalid or conflicting time ranges.
- Existing server-render checks, application/Worker/CLI type checks, lint, and the
  production frontend build passed.
- Browser checks used the local fixture with synthetic data: desktop and 390px
  mobile layout, source filtering, time-range switching, detail links, filter
  persistence after reload, and Reset. No button-text or layout snapshot locks added.

No migration or production data rewrite is required. Production admin figures require
an authenticated admin session; local fixture results do not verify those figures.
