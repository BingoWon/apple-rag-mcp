import type postgres from "postgres";

export interface CorpusStatsRecord {
	docs_total: number;
	videos_total: number;
	readable_pages: number;
	indexed_pages: number;
	navigation_only_pages: number;
	chunks_total: number;
	embedded_percentage: number | null;
	generated_at: string;
}

interface RawCorpusRow {
	docs_total: number;
	videos_total: number;
	readable_pages: number;
	indexed_pages: number;
	navigation_only_pages: number;
	chunks_total: number;
	refreshed_at?: Date | string;
}

function formatStats(row: RawCorpusRow): CorpusStatsRecord {
	const generatedAt =
		row.refreshed_at instanceof Date
			? row.refreshed_at.toISOString()
			: typeof row.refreshed_at === "string"
				? new Date(row.refreshed_at).toISOString()
				: new Date().toISOString();
	return {
		docs_total: row.docs_total,
		videos_total: row.videos_total,
		readable_pages: row.readable_pages,
		indexed_pages: row.indexed_pages,
		navigation_only_pages: row.navigation_only_pages,
		chunks_total: row.chunks_total,
		embedded_percentage: row.readable_pages
			? Math.floor((1000 * row.indexed_pages) / row.readable_pages) / 10
			: null,
		generated_at: generatedAt,
	};
}

export async function readCorpusStats(sql: postgres.Sql): Promise<CorpusStatsRecord> {
	// Fast O(1) path from hourly-refreshed snapshot table (<5ms vs ~6s full scan).
	try {
		const [snapshot] = await sql<RawCorpusRow[]>`
			SELECT docs_total, videos_total, readable_pages, indexed_pages,
				navigation_only_pages, chunks_total, refreshed_at
			FROM corpus_stats_snapshot
			WHERE id = 1`;
		if (snapshot) return formatStats(snapshot);
	} catch (error) {
		const code = (error as { code?: string } | null)?.code;
		if (code !== "42P01") throw error;
	}

	const [row] = await sql<RawCorpusRow[]>`
		WITH page_index AS (
			SELECT url, count(*) AS chunks, bool_or(embedding IS NOT NULL) AS indexed
			FROM chunks WHERE url LIKE 'https://developer.apple.com/%' GROUP BY url
		)
		SELECT count(*) FILTER (WHERE p.url NOT LIKE 'https://developer.apple.com/videos/play/%')::int AS docs_total,
			count(*) FILTER (WHERE p.url LIKE 'https://developer.apple.com/videos/play/%')::int AS videos_total,
			count(*) FILTER (WHERE octet_length(p.content) > 0)::int AS readable_pages,
			count(*) FILTER (WHERE octet_length(p.content) > 0 AND i.indexed)::int AS indexed_pages,
			coalesce(sum(i.chunks), 0)::int AS chunks_total,
			(SELECT count(*)::int FROM catalog_nodes WHERE NOT readable AND position('#' in url)=0) AS navigation_only_pages
		FROM pages p LEFT JOIN page_index i USING (url)
		WHERE p.url LIKE 'https://developer.apple.com/%'`;
	if (!row) throw Error("Missing corpus statistics");
	return formatStats(row);
}
