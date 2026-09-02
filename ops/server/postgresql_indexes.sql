\set ON_ERROR_STOP on

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pages_collection_queue
ON public.pages (
	collect_count,
	(CASE WHEN content IS NULL OR content = '' THEN 0 ELSE 1 END),
	(CASE WHEN title IS NULL OR title = '' THEN 0 ELSE 1 END),
	url,
	id
)
WHERE url LIKE 'https://developer.apple.com/%';

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_pages_url_casefold
ON public.pages (lower(url))
WHERE url LIKE 'https://developer.apple.com/%';

DROP INDEX CONCURRENTLY IF EXISTS public.idx_pages_url;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_pages_raw_json;

ANALYZE public.pages;
