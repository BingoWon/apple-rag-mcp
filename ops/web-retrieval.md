# Web retrieval

`search` retrieves only indexed Apple material. `fetch` first reads a nonempty
indexed page, then a fresh PostgreSQL cache entry. On a miss, Apple pages resolve
up to five redirects, check the canonical indexed URL, and try the existing
official JSON reader and cleaner. Remaining public pages use Firecrawl's single
page Markdown endpoint. Successful official JSON reads schedule that URL through
the existing collector; the request does not wait for embedding generation.

Content origin (`apple` or `third_party`) is independent of retrieval provider
(`index`, `apple_json`, `apple_http`, or `firecrawl`). `apple_http` identifies an
official-page HTTP error, not a successful extraction. Responses include origin,
source URL, provider and cache use. Third-party pages are never inserted into
`pages` or `chunks` automatically. Apple HTML pages also remain cache-only until
their content category is deliberately added to the indexed corpus.

## Storage and limits

Apply `ops/server/postgresql_web_retrieval.sql` to the VPS PostgreSQL database
before publishing code. It adds separate cache, alias and spending-counter tables
and grants the application role access. Retrieval data never moves to D1.

- Positive cache: 24 hours, at most 500 canonical documents. Aliases share their
  canonical cached body, expire with it and are capped at 1,000.
- Confirmed target 404/410: five-minute negative cache. Access blocks, timeouts,
  empty extraction and provider failures are not cached as missing pages.
- Query strings are preserved, but pages requested through query URLs bypass
  shared caching because parameters can contain private identifiers or signatures.
- Firecrawl output: at most 200,000 characters, with a 4 MB transport-body cap.
  Oversized content fails explicitly instead of being labeled complete.
- Live retrieval has one 30-second deadline; Firecrawl gets up to 20 seconds.
- `FIRECRAWL_DAILY_LIMIT`: shared UTC-day request ceiling, default 25; `0` disables
  cloud reads. Each attempted provider request reserves one slot atomically.
- `FIRECRAWL_API_KEY`: optional. An empty value uses keyless mode, which is subject
  to the provider's shared-IP restrictions. A dedicated account key is preferable
  for reliable production capacity. No account is created automatically.

Expired cache entries are ignored immediately and pruned on writes. Capacity
enforcement runs under a PostgreSQL transaction lock. Budget counters retain at
most the current UTC day plus seven days. Cache failures do not discard a readable
page; queue failures are logged and can be retried on a subsequent uncached read.

Only approved Apple hosts receive direct page requests. External targets go to
Firecrawl after public HTTP(S) URL validation and public DNS address checks.
Private/reserved addresses, embedded credentials and custom ports are rejected.
No caller cookies or authentication headers are forwarded. Firecrawl is asked
not to store the fetched content in its cache/index and to verify target TLS.
The DNS check cannot pin a cloud provider's later connections: its own redirect
and destination protections remain necessary. `storeInCache: false` is not a
zero-data-retention agreement.

## Log outcomes

Both tools persist an explicit outcome: `success`, `degraded`, `no_content`,
`limited`, `invalid`, `failed`, or `unknown`. Admin charts aggregate that field.
The admin API exposes `reason`; the existing D1 `error_code` column stores its
machine-readable value. Search logs include retrieval/model fallback reasons.
Fetch logs additionally include content origin, provider, upstream status and
cache use. Transport/provider status and target-page status are checked separately.
Live retrieval after an index miss is recorded as `degraded` with
`LIVE_READ_FALLBACK`, including subsequent cache hits; it is a usable response.

Apply D1 migration `0006_tool_outcomes.sql` before publishing. Historical fetch
404s become `no_content` with `INDEX_MISS`, never a claim about the original
website's HTTP status. Historical 200 searches with zero results become
`no_content`. Historical successful degradations cannot be reconstructed.
SDK-rejected arguments and canceled calls are outside these persisted outcome
counts. Tool errors on accepted calls refund the user's reserved quota; provider
spending reservations are not refunded.

The collector discovers child URLs even when parent text is unchanged. A 403 or
unsupported JSON layout does not authorize deletion. A JSON 404/410 requires the
original webpage to confirm removal before collected content is deleted; a
redirect or live HTML page keeps the record for retry.

## Verification

`pnpm build` runs lint, type checks, tests and the production build. Set
`TEST_DATABASE_URL` to an isolated PostgreSQL test database to run cache capacity,
expiry, alias, concurrent spending and collector scheduling tests. D1 tests apply
the repository migrations to SQLite and execute the real logging/aggregation SQL.
Publish by committing and pushing the release to `main`; do not deploy manually.
