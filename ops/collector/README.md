# Apple corpus collection

## Findings and acceptance criteria, 2026-11-20

A replay of 87 Apple documents found lost emphasis text on 13 pages, including the negation in Swift Array's Foundation bridging rules. Ten of 28 chunk boundaries detached a heading marker. The crawler discarded eight legitimate long links from two Apple parent pages. A PostgreSQL reproduction also showed that a delayed claim could replace a newer page and its index. The recovery command expected a result field the collector no longer returned.

The public snapshot contained 375,130 discovered URLs and 393,788 chunks. Neither a scheduling counter nor the ratio of chunks to URLs measures coverage. Report discovered, readable and indexed pages separately. Track the actual outcome of a batch and send update notifications after commit. Keep the existing corpus intact when a fetch, embedding request or replacement fails.

Validate the Markdown renderer against Apple source, the chunk boundaries against headings and code fences, and stale writes and recovery against isolated PostgreSQL. Keep batch size 30, the embedding group size 32 and the 30-second attempt timeout until workload measurements justify changing them. At 30 pages per five minutes, one pass through the snapshot needs at least 43.4 days.

## Coverage and incremental repair

The corpus endpoint reports discovered documentation and video URLs, readable pages, readable pages with at least one embedded chunk, chunk count, and navigation-only pages from the published catalog (section anchors excluded). Coverage is indexed readable pages divided by readable pages, rounded down to one decimal. An empty denominator has no percentage. The public result is cached for one hour.

When a page is revisited, the collector compares the rendered title, body and ordered chunk layout, including missing vectors. Only changes require embedding. New links are discovered even on unchanged pages. Replacements, metadata updates and removals use the claim generation. Targeted recovery claims explicit IDs, verifies saved content, and preserves pages when Apple cannot supply a replacement.

Embedding accepts at most 32 texts per request and runs one group at a time. Each group has a 120-second budget including retries, with 30 seconds per attempt. A provider delay that exceeds the remaining budget defers the work.

## Due-time scheduler rollout

Apply `ops/server/postgresql_collection_schedule.sql` on the corpus VPS before deploying the due-time Worker. Use the local PostgreSQL administrator and a verified current backup. The migration adds four columns without rewriting historical timestamps and builds two partial indexes concurrently. Check both indexes in pg_index for indisready and indisvalid before activating the Worker. Once production confirms the due-time Worker, retire the previous scheduling index with `DROP INDEX CONCURRENTLY IF EXISTS public.idx_pages_collection_queue`. If an index build is interrupted, remove only its invalid index concurrently and repeat the migration. The previous Worker can run throughout this preparation.

A claim reserves a page for 15 minutes. The host checks newly discovered or changed pages with priority; one third of each batch is available to overdue priority work before filling the remainder by due time. A changed page is due again in seven days, a stable page or known unavailable representation in 45 days, and a transient failure in one hour. These are scheduling targets subject to actual queue capacity. A failed refresh retains the last successful check and content. Existing rows start with unknown check history; checks populate it going forward.

## Repairing stored documents

Run `pnpm exec tsx ops/collector/audit-stored.mjs --limit 30` to replay stored Apple JSON against the renderer and current chunk layout without writing or calling a provider. Add `--apply` to rediscover its links and refetch only the candidate pages before committing repairs. The live refetch avoids publishing a stale saved representation. Output contains cumulative counts and the last completed UUID. Pass it via `--after UUID` for the next batch. Invalid source rows are counted and preserved. Explicit recovery never deletes a page. Resume from the last completed batch if the database or provider is unavailable.

On the configured VPS the migration command is:

```sh
ssh apple-rag 'docker exec -i postgres_db psql -X -v ON_ERROR_STOP=1 -U apple_rag_local_admin -d apple_rag_db' < ops/server/postgresql_collection_schedule.sql
```

Leave the four additive columns and their data in place on application rollback. No historical success times can be inferred from the old claim counter.
