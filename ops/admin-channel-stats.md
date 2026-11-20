# Admin MCP / CLI statistics

The overview compares MCP and CLI request sources in one trend chart. An unknown
series appears only when unclassified records actually exist (or that filter is selected).
Counts include recorded search, browse and fetch attempts, including rate limits and failures;
they are not counts of successful retrievals or billable usage. Each source shows its
share of all recorded calls in the selected period. Historical records confirmed to belong to the MCP-only era are corrected once by
migration 0012. Unverified records are not silently treated as MCP.

`GET /api/admin/stats` accepts `channel=mcp|cli|unknown`. The filter applies to the
search, browse and fetch metrics and their outcomes. The source comparison always includes
all sources. User, active-user, token, IP, message, and subscription statistics remain
global; accounts and subscriptions are shared across access methods. Per-tool
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

## Historical correction — 2026-11-04

Migration 0009 added `channel` with an `unknown` default, leaving old MCP traffic
unattributed. Production inspection found 18,771 search and 7,236 fetch rows in that
state, all without modern request IDs. Their latest timestamps were respectively
2026-11-03 08:23:57.873Z and 08:07:30.824Z. The first recorded CLI call was at
08:55:06.822Z. Legacy writers had been retired before migration 0010 applied at
08:39:15Z.

Migration 0012 updates only unknown rows without request IDs before that fixed UTC
cutover. It does not alter known MCP/CLI records or infer a source for later unknown
rows. Reapplying it is harmless. Logging now requires the full server-created
operation context; there is no fallback to an unknown channel. Unknown is not a
third access method, and zero-count unknown entries are omitted from the overview.

A SQL-backed test covers the cutoff, tracked requests, known channels, invalid dates,
and repeat execution. Existing tool logging checks exercise real MCP calls through
the service and database writer. Counts and percentages also contain explicit text
spacing and use up to two decimal places to avoid presenting small shares as zero.

Production verification after migration: search MCP 18,801 / CLI 1, fetch MCP 7,252,
unknown 0 in both tables. No CLI rows were changed. These are all-time counts at
verification, not a fixed value for the dashboard's selected period.


## Account and admin activity

The user overview shows the current weekly quota counter separately from recorded activity over the last 24 hours or 7/30 Singapore calendar days. Daily buckets start at UTC+8 midnight. The account statistics response contains the exact half-open window, the total, counts by tool, and aligned zero-filled buckets. Links to a tool's usage history carry the same start and end instants, including failed and rate-limited calls. The result counts of unlike tools are not added into the activity chart.

The admin activity section compares the three tools on one scale. Selecting a tool shows its outcomes, and the row link preserves the time and channel filters when opening logs. Empty, loading and unavailable statistics are displayed separately.

## Client attribution

The **Client usage** tab at `/admin/clients` reads the search, browse and fetch
logs, including failed, limited and cancelled attempts. It defaults to a rolling
seven-day window. The other choices are the last 24 hours, the last 30 days and
all retained history. Rows without a usable timestamp contribute only to all-time totals. The displayed cutoff is in Singapore time. Breakdowns reuse
the report's cutoff. Opening this page makes no retrieval calls.

The server assigns MCP or CLI from the entry point. Products and environments
are self-reported, matched against known User-Agent signatures. An OpenCode or
Claude Code shell integration on the MCP endpoint counts as MCP. A curl request
to the CLI API counts as CLI traffic from an HTTP tool. Official CLI versions use
the explicit version header when available. The launching agent is unavailable.
Directory probes, HTTP tools, unclassified labels and absent historical labels
remain in the denominator as separate groups. For an unclassified label, a short alphabetic product name before an explicit version may be shown as reported evidence. It still counts as unclassified. Recognition rules apply at read time.

Account counts use distinct IDs that match the accounts table for the entire
report, each channel and each product independently. Summing per-product accounts
can count a shared account twice. Calls without a matching account include anonymous
traffic. HTTP 2xx, HTTP 429 and all other responses partition each row's attempts.
The admin-only breakdown exposes aggregated environments and versions, with stable
pagination. It returns no raw User-Agent, account ID, credential, IP or query text.
