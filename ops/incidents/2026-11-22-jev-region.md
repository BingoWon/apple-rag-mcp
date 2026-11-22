# Jev region denial during search

## Production routing

Apple RAG uses Cloudflare’s visitor network country (`request.cf.country`) to choose a reranker before sending search candidates to a model. The ingress data center (`request.cf.colo`) is recorded for diagnostics. [Cloudflare request metadata](https://developers.cloudflare.com/workers/runtime-apis/request/#incomingrequestcfproperties)

| Condition | Action |
| --- | --- |
| Country is `CN`, at any ingress or with no ingress information | Send the candidates directly to Qwen3-Reranker-8B. Skip both TypeSafe and ZenMux from the first search. |
| Any other country, or country unknown | Try TypeSafe Jev first. |
| TypeSafe returns HTTP 451 with the JSON title `Typesafe is not available in your region.` | Use Qwen for this search immediately. This response does not add a new route to the rule. |
| TypeSafe fails for another reason | Try ZenMux Jev if configured, then Qwen if needed. |

Starting in v5.15.10, the country rule covers every `CN` search across MCP and CLI. This product policy avoids an upstream wait even on ingress routes that have not been individually tested. User searches do not run timed recovery probes. [Routing implementation](../../worker/services/reranker.ts) · [Routing tests](../../worker/services/reranker.test.ts)

When Qwen supplies scores, the search records `RERANKER_FALLBACK` and the actual model usage. Expected regional routing is logged without a provider failure alert. Actual upstream failures include the request ID, provider diagnostics and final result count in the alert. If Qwen also fails, search can return the candidates in retrieval order with `RERANKING_UNAVAILABLE`.

## Production evidence

On 22 November 2026, three MCP searches used the same query and result limit. TypeSafe returned scores on the US/DFW route. Two searches on the CN/AMS route received TypeSafe’s regional 451, followed by a ZenMux 400 reporting an upstream System One failure. Qwen ranked the candidates. All three searches returned four results. Removing the DeepSeek Harness client label made no difference. ZenMux’s 400 did not disclose its upstream status.

A separate Worker preview sent identical empty JSON bodies to TypeSafe with no model credentials or forwarded visitor headers. TypeSafe’s Cloudflare trace reported the same shared Worker IP on both routes. It reported `loc=CN` at AMS, where the API returned 451, and `loc=US` at DFW, where the API asked for a key (403). A direct CN request through LAX also received the regional 451. The receiving edge could identify a country even with an empty application payload. TypeSafe’s internal rule remains unverified. [Cloudflare cross-zone request headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/#cf-connecting-ip-in-worker-subrequests)

A US-origin production search at 02:10 UTC returned four results with one metered Jev attempt. All matching US MCP POSTs in that time window entered through AMS. This historical comparison was correlated by time window.

## Where to read the country

Use the Worker metadata for live routing and D1’s `search_logs.country_code` for historical lookup. Two read-only tests against the VPS PostgreSQL corpus confirmed that the database session had no visitor country on its own. Binding the Worker’s country as a SQL parameter returned `CN` and `US` respectively. Routing needs no PostgreSQL lookup. These tests covered database retrieval. A separate HTTPS call from the VPS to Jev has not been verified. [Worker metadata extraction](../../worker/services/request-info.ts) · [Search log fields](../../worker/services/tool-call-logger.ts)
