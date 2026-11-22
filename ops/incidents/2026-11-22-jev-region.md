# Jev region denial during search

On 22 November, three production searches used the same query, result limit and MCP endpoint. The proxied connection reached DFW from a US exit and TypeSafe returned scores. Two direct connections reached AMS from a CN exit. Both received TypeSafe HTTP 451 with its regional unavailability message, then ZenMux HTTP 400 with a System One upstream request ID. Qwen reranked both searches. Each search returned four results. Removing the DeepSeek Harness client label had no effect. ZenMux's 400 does not identify its upstream status.

## Handling a recurrence

The first regional denial follows the usual TypeSafe → ZenMux → Qwen order. Two explicit TypeSafe regional denials within ten minutes pause TypeSafe for five minutes on that path. A successful TypeSafe attempt or another TypeSafe error clears the streak. The next search after the pause tests TypeSafe again. A further region denial renews the pause. A skipped attempt consumes no model usage. ZenMux continues to run independently, including after a 400. If Qwen also fails, search can still return the original candidates.

The short-lived markers live in a named Workers cache local to the executing data center and are partitioned by Cloudflare's incoming colo and visitor country. They contain only a timestamp. Eviction, a cache error, or missing route metadata allows a normal TypeSafe attempt. Concurrent isolates may send an extra probe. There is no central write or cross-region switch.

Ranking alerts identify the tool request, ingress Ray ID, route, model errors, available upstream IDs, selected ranking and final result count. The Worker-side Cloudflare trace colo is sampled in the background for Telegram. Smart Placement's exact decision for a particular request can be checked using its client-visible response header. The provider's own geographic classification is not exposed. Use the ZenMux request ID to ask the provider to look up the upstream failure.

[Cloudflare placement](https://developers.cloudflare.com/workers/configuration/placement/#check-the-cf-placement-header) · [Cache locality](https://developers.cloudflare.com/workers/runtime-apis/cache/)
