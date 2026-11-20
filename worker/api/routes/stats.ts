import postgres from "postgres";
import { readCorpusStats } from "../../shared/corpus-stats.js";
import { ApiErrorCode } from "../constants/error-codes";
import { createOpenAPIApp } from "../utils/openapi";

const app = createOpenAPIApp();
const CACHE_TTL_SECONDS = 3600;
function createCacheKey(requestUrl: string): Request {
	const url = new URL(requestUrl);
	url.pathname = "/api/stats/corpus";
	url.search = "?metrics=coverage";
	return new Request(url.toString(), { method: "GET" });
}

function createStatsResponse(data: Awaited<ReturnType<typeof readCorpusStats>>): Response {
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
		const data = await readCorpusStats(sql);

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
