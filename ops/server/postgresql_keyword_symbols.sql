\set ON_ERROR_STOP on

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunks_symbol ON public.chunks USING hash
(lower(split_part(regexp_replace(split_part(title, chr(10), 1), '^[^:]+: ', ''), '(', 1))) WHERE chunk_index = 0 AND title IS NOT NULL;
