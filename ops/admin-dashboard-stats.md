# Admin Dashboard Statistics

The admin homepage uses the installed
[ApexCharts](https://github.com/apexcharts/apexcharts.js) charts and the existing
period selector.

The admin console is a compact personal workspace. Omit introductory headings
and repeated captions, combine navigation and actions into compact rows, and
keep one card shell per metric.

- Six trends count records created within the selected window: users, tokens,
  authorized IPs, search calls, fetch calls, and contact messages.
- Search and fetch use stacked bars for success (`200`), rate limits (`429`),
  other known status codes, and unknown historical statuses. All seven detail
  pages remain accessible.
- The paid-user panel is a current snapshot of active Pro and Enterprise
  entitlements, excluding expired one-time packages. It does not claim historical
  subscription growth and does not change with the selected date range.
- `GET /api/admin/stats` uses the existing admin password middleware and disables
  response caching. Usage, subscription, and model cost reads use D1 batches.
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

## Model costs

Migration `0013_model_usage.sql` stores one metering record per upstream model
attempt. The Admin chart includes MCP and CLI searches and the Worker's document
indexing batches. Selecting a channel limits the model chart to that channel.
The chart begins with the first recorded attempt. Earlier expenses, standalone
maintenance scripts, and evaluation calls can be checked in provider billing.

Mainland China searches use Microsoft Decision 1.1 through ZenMux first. Its scores use the same rubric as Jev; calls are estimated at $0.042 per million input tokens. The dashboard separates Microsoft Decision from Qwen using the requested model ID in `model_usage_events.model`. Historical rows keep their original categories. For other visitor countries and unknown origins, official Jev runs first. If it fails, `ZENMUX_API_KEY` enables `typesafe/jev-1.14`
via the [ZenMux System One API](https://zenmux.ai/docs/api/typesafe/systemone.html).
Both count toward Jev at $0.042 per million input tokens. If the selected decision route fails to produce usable scores, DeepInfra's Qwen3-Reranker-8B runs. Its reported cost takes
precedence over the $0.050 per million input tokens estimate. Embedding estimates
use ¥0.14 per million input tokens for SiliconFlow China and $0.020 for DeepInfra.
Attempts without usage or cost are reported separately. Local chart estimates can
be reconciled against provider billing.

The chart stores amounts in original currencies at billionth-unit precision.
The USD total estimates CNY conversion at the configured `MODEL_COST_CNY_PER_USD`
reference rate. The initial rate is 6.7152 from the [November 13, 2026 CFETS
central parity](https://www.chinamoney.com.cn/english/bmkcpr/index.html?tab=2).

## Online search embedding retries

MCP and CLI search try SiliconFlow, then DeepInfra, with up to 3 seconds for
each request. If neither returns a usable 2560-dimensional vector, they repeat
the same order with up to 5 seconds each. A single 16-second deadline covers
both rounds. Each step makes one HTTP request. Missing credentials, permanent
HTTP errors and an upstream retry-after that is still in effect skip that
provider. Client cancellation stops the entire search. If embedding is
exhausted, search can continue with the keyword results already fetched in
parallel. The collector uses its separate 30-second batch timeout.

Each dispatched request emits a Worker log with message `embedding_attempt`,
linked to the tool response and `search_logs` by `request_id`. It records one
`model_usage_events` row with the same provider, attempt number, timeout budget,
elapsed milliseconds, outcome and any HTTP error status, even if the attempt was
cancelled or the upstream returned no usage. A successful attempt means the
response contained a usable vector. Attempt metadata starts with migration 0018.
Earlier usage rows and collector batches have no online attempt details.
`embedding_exhausted` identifies searches that
ran out of embedding options. `EMBEDDING_FALLBACK` in search logs indicates
that the alternate provider was tried, even when the primary subsequently
recovered. `SEMANTIC_UNAVAILABLE` identifies searches that lost the semantic
branch, which can also happen if vector lookup in PostgreSQL fails.

For an embedding incident the Worker sends one Telegram summary at the end of
each affected search. The first line states whether retrieval recovered, ran
with keywords or vectors alone, or failed. It includes the result count and
elapsed milliseconds from the start of tool execution. The following lines show
the attempts in order, any ranking incident and the request ID. A completed
search can return zero matches. Healthy searches and client cancellations send
no model alert. Repeated ranking-only alerts keep their existing cooldown.

To evaluate the longer retry round in D1, group the last seven days by the
dispatched attempt that produced the vector. The zero bucket includes exhaustion
and client cancellations. The mean includes the time spent on all dispatched
5-second attempts, including failures. This measures embedding time; keyword
lookup runs concurrently. Use the tool response time for end-to-end latency.

```sql
WITH retries AS (
  SELECT request_id,
         MAX(CASE WHEN attempt_outcome = 'success' THEN attempt_no END) AS winner,
         SUM(elapsed_ms) AS retry_ms
  FROM model_usage_events
  WHERE category = 'embedding' AND timeout_ms = 5000
    AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-7 days')
  GROUP BY request_id
)
SELECT COALESCE(winner, 0) AS successful_attempt, COUNT(*) AS searches,
       ROUND(AVG(retry_ms)) AS mean_retry_ms
FROM retries
GROUP BY COALESCE(winner, 0)
ORDER BY successful_attempt;
```

Compare equal UTC windows before and after a release. Use the 99th percentile
of `search_logs.response_time_ms` for served searches (success, degraded or
no_content), the proportion of those searches with `SEMANTIC_UNAVAILABLE`,
and the number of online embedding attempts in `model_usage_events` divided
by the served search count. Filter model usage to MCP and CLI to exclude
collector batches. Failed and cancelled searches can also consume attempts;
check their counts alongside the ratio.
