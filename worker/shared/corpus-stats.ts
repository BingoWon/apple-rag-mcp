import type postgres from "postgres";

export async function readCorpusStats(sql: postgres.Sql) {
	const [row] = await sql<
		{
			docs_total: number;
			videos_total: number;
			readable_pages: number;
			indexed_pages: number;
			navigation_only_pages: number;
			chunks_total: number;
		}[]
	>`
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
	return {
		...row,
		embedded_percentage: row.readable_pages
			? Math.floor((1000 * row.indexed_pages) / row.readable_pages) / 10
			: null,
		generated_at: new Date().toISOString(),
	};
}
