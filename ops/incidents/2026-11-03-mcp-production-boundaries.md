# MCP production boundary audit and correction

Recorded: 2026-11-03 (Asia/Singapore). Fix release: 5.2.3.

## Evidence

The production 5.2.2 endpoint was exercised with official TypeScript MCP clients
2.3.1 and 2.4.0 using the owner's explicitly supplied test account. The 57 tool
calls included expected rejections and a controlled cancellation. The account's
21 successful calls matched its weekly usage counter; failed/cancelled calls
were refunded. A synthetic token was used for invalid-credential testing.
No real credentials belong in this document or test fixtures.

Verified working: modern discovery and legacy initialize followed by actual tool
calls, default/min/max search counts, Apple document and WWDC transcript reading,
URL normalization and redirects, official JSON fallback and cache hits, third-party
HTML fallback, positive/negative caching, query preservation and cache bypass,
404 classification, input limits, SSRF guards and three concurrent indexed reads.
Third-party example content was absent from the RAG corpus. Official JSON
fallback queued the document and the collector subsequently populated its body.
An exact-limit invented Apple URL was accepted by input validation but blocked by
the target/provider; this was an upstream access failure, not evidence of a 404.

## Findings and changes

| Finding | Correction | Regression coverage |
| --- | --- | --- |
| Whitespace-only searches passed min-length validation and became `SEARCH_FAILED` / 500 | Require a non-whitespace character before dispatch | Modern and legacy protocol tests; no retrieval or quota reservation |
| Unknown/malformed Authorization silently became IP-authenticated or anonymous | Explicit credentials fail closed with HTTP 401 and a Bearer challenge; absent credentials retain IP/anonymous access | Auth identity tests including an authorized IP; HTTP 401 and no-store test |
| Failed authentication printed the full header and token | Log a fixed rejection message without credentials or database error text | Captured warning test with synthetic secrets |
| SDK argument rejection was missing from tool logs | Observe the existing Standard Schema validator, preserve its JSON discovery schema and defaults, log one `invalid` / `INVALID_ARGUMENTS` event | Missing/wrong-type/over-limit/count and whitespace tests through both protocol eras |
| Client cancellation was missing from tool logs | Persist `cancelled` / `REQUEST_CANCELLED` (499), refund only actual quota reservations, expose cancellation in bilingual admin charts/API | Both tools before/after quota and during retrieval; HTTP abort; real SQL migration and admin aggregate tests |

Authentication infrastructure failures return 503 rather than changing identity.
Authentication occurs before SDK request dispatch; invalid credentials do not
invoke tools or consume their quota. The legacy stateless protocol remains enabled
as required by the [Cursor incident](2026-10-19-cursor-mcp-protocol.md).

## Data and release procedure

D1 migration `0007_cancelled_tool_outcomes.sql` extends each log table's CHECK
constraint by rebuilding it transactionally through D1 migrations. All columns,
rows, primary keys and secondary indexes are preserved; a regression test compares
historical rows and index definitions before/after migration. Apply it before
pushing 5.2.3 to main. PostgreSQL retrieval data is unchanged.

`pnpm build` must pass before release. Push the matching package/server versions
to main, allow automatic Worker deployment and CI release creation, then verify
production HTTP auth, schema rejection, normal tool calls, cancellation, logs and
quota. Production verification results are appended after deployment.

## Boundaries

These tool tables count recognized tool dispatch attempts, including argument
validation and cancellation after dispatch. Authentication failures, malformed
JSON/protocol envelopes, unknown tools, and disconnects before dispatch belong to
transport/request observability and are not counted as searches/fetches. These
counts are not all HTTP traffic. Historical missing events cannot be recovered.
Historical provider logs may contain rejected credentials until the provider's
retention policy expires; removing the logging statement is not retroactive erasure.

This audit did not exhaust shared provider or account quota, stress production,
simulate provider outages, or operate every advertised desktop client. Arbitrary
third-party readability and DNS-rebinding protections at the cloud provider remain
subject to the limits documented in [web retrieval](../web-retrieval.md).
