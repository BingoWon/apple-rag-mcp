\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE canonical_url_map ON COMMIT DROP AS
WITH page_stats AS (
	SELECT
		p.id,
		p.url,
		lower(p.url) AS canonical_url,
		p.updated_at,
		length(COALESCE(p.content, '')) AS content_length,
		COUNT(c.id) AS chunk_count
	FROM public.pages p
	LEFT JOIN public.chunks c ON c.url = p.url
	WHERE p.url LIKE 'https://developer.apple.com/%'
	GROUP BY p.id
),
ranked AS (
	SELECT
		*,
		COUNT(*) OVER (PARTITION BY canonical_url) AS alias_count,
		ROW_NUMBER() OVER (
			PARTITION BY canonical_url
			ORDER BY chunk_count DESC, updated_at DESC NULLS LAST, content_length DESC, id
		) AS rank,
		MAX(id::text) FILTER (WHERE url = canonical_url) OVER (PARTITION BY canonical_url) AS lowercase_id
	FROM page_stats
)
SELECT
	canonical_url,
	(MAX(id::text) FILTER (WHERE rank = 1))::uuid AS winner_id,
	MAX(url) FILTER (WHERE rank = 1) AS winner_url,
	COALESCE(
		MAX(lowercase_id),
		MAX(id::text) FILTER (WHERE rank = 1)
	)::uuid AS target_id
FROM ranked
WHERE alias_count > 1
GROUP BY canonical_url;

UPDATE public.pages target
SET
	raw_json = winner.raw_json,
	title = winner.title,
	content = winner.content,
	collect_count = GREATEST(target.collect_count, winner.collect_count),
	updated_at = GREATEST(target.updated_at, winner.updated_at)
FROM canonical_url_map map
JOIN public.pages winner ON winner.id = map.winner_id
WHERE target.id = map.target_id
	AND target.id <> winner.id;

DELETE FROM public.chunks chunk
USING canonical_url_map map
WHERE lower(chunk.url) = map.canonical_url
	AND chunk.url <> map.winner_url;

UPDATE public.chunks chunk
SET url = map.canonical_url
FROM canonical_url_map map
WHERE chunk.url = map.winner_url
	AND chunk.url <> map.canonical_url;

DELETE FROM public.pages page
USING canonical_url_map map
WHERE lower(page.url) = map.canonical_url
	AND page.id <> map.target_id;

UPDATE public.pages page
SET url = map.canonical_url
FROM canonical_url_map map
WHERE page.id = map.target_id
	AND page.url <> map.canonical_url;

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM public.pages
		WHERE url LIKE 'https://developer.apple.com/%'
		GROUP BY lower(url)
		HAVING COUNT(*) > 1
	) THEN
		RAISE EXCEPTION 'Case-insensitive duplicate Apple URLs remain';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM public.chunks chunk
		LEFT JOIN public.pages page ON page.url = chunk.url
		WHERE page.id IS NULL
	) THEN
		RAISE EXCEPTION 'Orphan chunks detected after canonicalization';
	END IF;
END
$$;

COMMIT;

ANALYZE public.pages;
ANALYZE public.chunks;
