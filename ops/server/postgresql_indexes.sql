\set ON_ERROR_STOP on

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_pages_url_casefold
ON public.pages (lower(url))
WHERE url LIKE 'https://developer.apple.com/%';

DROP INDEX CONCURRENTLY IF EXISTS public.idx_pages_url;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_pages_raw_json;

ANALYZE public.pages;
