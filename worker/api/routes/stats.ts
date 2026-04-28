import postgres from "postgres";
import { ApiErrorCode } from "../constants/error-codes";
import { createOpenAPIApp } from "../utils/openapi";

const app = createOpenAPIApp();
const CACHE_TTL_SECONDS = 3600;
const APPLE_URL_PATTERN = "https://developer.apple.com/%";
const VIDEO_URL_PATTERN = "https://developer.apple.com/videos/play/%";

interface CorpusStats {
	docs_total: number;
	videos_total: number;
	chunks_total: number;
	embedded_percentage: 100;
	generated_at: string;
}

function createCacheKey(requestUrl: string): Request {
	const url = new URL(requestUrl);
	url.pathname = "/api/stats/corpus";
	url.search = "";
	return new Request(url.toString(), { method: "GET" });
}

function createStatsResponse(data: CorpusStats): Response {
	return new Response(JSON.stringify({ success: true, data }), {
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=300`,
		},
	});
}

app.get("/corpus", async (c) => {
	const cacheKey = createCacheKey(c.req.url);
	const cached = await caches.default.match(cacheKey);
	if (cached) return cached;

	const sql = postgres({
		host: c.env.RAG_DB_HOST,
		port: Number.parseInt(c.env.RAG_DB_PORT || "5432", 10),
		database: c.env.RAG_DB_DATABASE,
		username: c.env.RAG_DB_USER,
		password: c.env.RAG_DB_PASSWORD || "",
		ssl: c.env.RAG_DB_SSLMODE !== "disable",
		max: 1,
		idle_timeout: 10,
		connect_timeout: 10,
		transform: { undefined: null },
		onnotice: () => {},
	});

	try {
		const rows = await sql`
			WITH page_counts AS (
				SELECT
					COUNT(*) FILTER (
						WHERE url LIKE ${APPLE_URL_PATTERN}
						  AND url NOT LIKE ${VIDEO_URL_PATTERN}
					) AS docs_total,
					COUNT(*) FILTER (
						WHERE url LIKE ${VIDEO_URL_PATTERN}
					) AS videos_total
				FROM pages
				WHERE url LIKE ${APPLE_URL_PATTERN}
			),
			chunk_counts AS (
				SELECT COUNT(*) AS chunks_total
				FROM chunks
				WHERE url LIKE ${APPLE_URL_PATTERN}
			)
			SELECT
				page_counts.docs_total,
				page_counts.videos_total,
				chunk_counts.chunks_total
			FROM page_counts, chunk_counts
		`;

		const row = rows[0] || {};
		const data: CorpusStats = {
			docs_total: Number(row.docs_total) || 0,
			videos_total: Number(row.videos_total) || 0,
			chunks_total: Number(row.chunks_total) || 0,
			embedded_percentage: 100,
			generated_at: new Date().toISOString(),
		};

		const response = createStatsResponse(data);
		c.executionCtx.waitUntil(caches.default.put(cacheKey, response.clone()));
		return response;
	} catch (error) {
		console.error(
			`Corpus stats query failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		return c.json(
			{
				success: false,
				error: {
					code: ApiErrorCode.INTERNAL_ERROR,
					message: "Failed to retrieve corpus statistics",
				},
			},
			500,
		);
	} finally {
		await sql.end().catch(() => {});
	}
});

export default app;
