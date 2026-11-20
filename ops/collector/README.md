# Apple corpus collection

## Production verification for 5.15.7

On November 20, 2026, the production coverage endpoint counted 375,130 discovered Apple URLs and 373,619 readable pages. Each readable page had at least one vector. Coverage was therefore 100% for readable pages at that snapshot.

Replaying the same 87 official source documents preserved all the previously lost emphasis text. The same 28 chunk boundaries had zero detached headings and zero splits inside fenced examples. Production recovery then processed 22 verified URLs in bounded batches: 20 required replacements (48 chunks), two were unchanged, and none failed or were deleted. For all 22, the stored title, body and ordered index layout matched a fresh rendering of the saved Apple source. All eight verified long links from the two parent pages were present in the discovery table. A subsequent production MCP fetch of Swift Array returned the original negation in its Foundation bridging documentation.

These checks cover the verified pages. Remaining historical entries are checked incrementally when the collector revisits them.

## Findings and acceptance criteria, 2026-11-20

A replay of 87 Apple documents found lost emphasis text on 13 pages, including the negation in Swift Array's Foundation bridging rules. Ten of 28 chunk boundaries detached a heading marker. The crawler discarded eight legitimate long links from two Apple parent pages. A PostgreSQL reproduction also showed that a delayed claim could replace a newer page and its index. The recovery command expected a result field the collector no longer returned.

The public snapshot contained 375,130 discovered URLs and 393,788 chunks. Neither a scheduling counter nor the ratio of chunks to URLs measures coverage. Report discovered, readable and indexed pages separately. Track the actual outcome of a batch and send update notifications after commit. Keep the existing corpus intact when a fetch, embedding request or replacement fails.

Validate the Markdown renderer against Apple source, the chunk boundaries against headings and code fences, and stale writes and recovery against isolated PostgreSQL. Keep batch size 30, the embedding group size 32 and the 30-second attempt timeout until workload measurements justify changing them. At 30 pages per five minutes, one pass through the snapshot needs at least 43.4 days.

## Coverage and incremental repair

The corpus endpoint reports discovered documentation and video URLs, readable pages, readable pages with at least one embedded chunk, chunk count, and navigation-only pages from the published catalog (section anchors excluded). Coverage is indexed readable pages divided by readable pages, rounded down to one decimal. An empty denominator has no percentage. The public result is cached for one hour.

When a page is revisited, the collector compares the rendered title, body and ordered chunk layout, including missing vectors. Only changes require embedding. New links are discovered even on unchanged pages. Replacements, metadata updates and removals use the claim generation. Targeted recovery claims explicit IDs, verifies saved content, and preserves pages when Apple cannot supply a replacement.

Embedding accepts at most 32 texts per request and runs one group at a time. Each group has a 120-second budget including retries, with 30 seconds per attempt. A provider delay that exceeds the remaining budget defers the work.
