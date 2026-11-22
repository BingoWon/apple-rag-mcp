# Jev region denial during search

On 22 November, three production searches used the same query, result limit and MCP endpoint. The proxied connection reached DFW from a US exit and TypeSafe returned scores. Two direct connections reached AMS from a CN exit. Both received TypeSafe HTTP 451 with its regional unavailability message, then ZenMux HTTP 400 with a System One upstream request ID. Qwen reranked both searches. Each search returned four results. Removing the DeepSeek Harness client label had no effect. ZenMux's 400 does not identify its upstream status.

## What the receiving edge saw

A separate Worker preview sent a fixed empty JSON object to TypeSafe with no model credential, client label, or forwarded visitor headers. On the CN/AMS path, TypeSafe’s own Cloudflare trace returned `loc=CN`, `colo=AMS`; the API returned the regional 451. On the US/DFW path the trace returned `loc=US` and the API asked for an API key (403). In both previews the destination trace reported the same documented cross-zone Worker IP. The country still differed. Direct requests from the Mac also returned the regional 451 through LAX for the CN connection. No inference was needed to reproduce the rejection. These measurements establish that country information can reach the receiving edge independently of the application payload. They do not reveal TypeSafe’s private rule expression.

In a separate historical comparison, a US-origin production search at 02:10 UTC returned four results and one metered Jev attempt. All matching US MCP POSTs in its time window entered through AMS. This is a time-window correlation rather than a per-request Ray ID match.

## Production routing

Searches with Cloudflare visitor country CN and ingress AMS go straight to Qwen. Both Jev routes failed repeatedly on this production path. Other paths keep TypeSafe first. If TypeSafe explicitly denies the region, the same search continues with Qwen. Other TypeSafe errors can still recover through ZenMux. Change the known path only when new production evidence or provider guidance justifies it.

Qwen use is recorded as `RERANKER_FALLBACK` with its actual model usage. An expected route selection is logged without generating a provider error alert. If Qwen fails, the search engine can return candidates in retrieval order and records `RERANKING_UNAVAILABLE`. Actual upstream failures retain the request ID, provider diagnostics and final result count in the alert.

[Cloudflare cross-zone request headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/#cf-connecting-ip-in-worker-subrequests) · [Cloudflare placement](https://developers.cloudflare.com/workers/configuration/placement/#check-the-cf-placement-header)
