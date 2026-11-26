import postgres from "postgres";
import {
	DOC_CHANGE_KINDS,
	type DocChangeDigest,
	type DocChangeEventItem,
	type DocChangeKind,
	type UpdatesSummaryResponse,
} from "../../../shared/doc-updates.js";
import { SITE_ORIGIN } from "../../../shared/site.js";
import type { Env } from "../../shared/types.js";
import { ApiErrorCode } from "../constants/error-codes";
import { createOpenAPIApp } from "../utils/openapi";

const app = createOpenAPIApp();

const SUMMARY_TTL = 300;
const FEED_TTL = 180;
const SYNDICATION_TTL = 600;
const VALID_KINDS = new Set<string>(DOC_CHANGE_KINDS);

function createPgClient(env: Env) {
	return postgres({
		host: env.RAG_DB_HOST,
		port: Number.parseInt(env.RAG_DB_PORT || "5432", 10),
		database: env.RAG_DB_DATABASE,
		username: env.RAG_DB_USER,
		password: env.RAG_DB_PASSWORD || "",
		ssl: env.RAG_DB_SSLMODE !== "disable",
		max: 1,
		idle_timeout: 10,
		connect_timeout: 10,
		prepare: false,
		connection: {
			application_name: "apple-rag-updates",
			statement_timeout: 10_000,
		},
		transform: { undefined: null },
		onnotice: () => {},
	});
}

function escapeXml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

function escapeLike(value: string): string {
	return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

async function withEdgeCache(
	requestUrl: string,
	ttlSeconds: number,
	waitUntil: (promise: Promise<unknown>) => void,
	producer: () => Promise<Response>,
): Promise<Response> {
	const cache = typeof caches !== "undefined" ? caches.default : null;
	const cacheKey = new Request(requestUrl, { method: "GET" });
	if (cache) {
		const hit = await cache.match(cacheKey);
		if (hit) return hit;
	}
	const response = await producer();
	if (cache && response.ok && ttlSeconds > 0) {
		waitUntil(cache.put(cacheKey, response.clone()));
	}
	return response;
}

export function renderUpdatesRssXml(
	digests: readonly DocChangeDigest[],
	events: readonly DocChangeEventItem[],
): string {
	const items: string[] = [];

	for (const digest of digests) {
		const title = `[${digest.period_type === "weekly" ? "Weekly" : "Daily"} Digest] ${digest.content_en.headline}`;
		const link = `${SITE_ORIGIN}/updates/digest/${encodeURIComponent(digest.period_type)}/${encodeURIComponent(digest.period_key)}`;
		const desc = [digest.content_en.overview, ...digest.content_en.strategy_notes].join("\n\n");
		items.push(
			[
				"    <item>",
				`      <title>${escapeXml(title)}</title>`,
				`      <link>${escapeXml(link)}</link>`,
				`      <guid isPermaLink="false">apple-rag-digest:${escapeXml(digest.period_type)}:${escapeXml(digest.period_key)}</guid>`,
				`      <pubDate>${new Date(digest.generated_at).toUTCString()}</pubDate>`,
				`      <category>${escapeXml(digest.period_type)}</category>`,
				`      <description>${escapeXml(desc)}</description>`,
				"    </item>",
			].join("\n"),
		);
	}

	for (const event of events) {
		const title = `[${event.framework}] [${event.change_kind}] ${event.title}`;
		const desc = event.diff_snippet ? `${event.summary}\n\n${event.diff_snippet}` : event.summary;
		items.push(
			[
				"    <item>",
				`      <title>${escapeXml(title)}</title>`,
				`      <link>${escapeXml(event.url)}</link>`,
				`      <guid isPermaLink="false">apple-rag-event:${event.id}</guid>`,
				`      <pubDate>${new Date(event.detected_at).toUTCString()}</pubDate>`,
				`      <category>${escapeXml(event.framework)}</category>`,
				`      <description>${escapeXml(desc)}</description>`,
				"    </item>",
			].join("\n"),
		);
	}

	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
		"  <channel>",
		"    <title>Apple RAG — Apple Developer Docs Pulse</title>",
		`    <link>${SITE_ORIGIN}/updates</link>`,
		`    <atom:link href="${SITE_ORIGIN}/api/updates/rss.xml" rel="self" type="application/rss+xml" />`,
		"    <description>Live Apple Developer Documentation change radar, structured diffs, and AI trend digests tracked by Apple RAG.</description>",
		"    <language>en-us</language>",
		`    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
		...items,
		"  </channel>",
		"</rss>",
	].join("\n");
}

app.get("/summary", async (c) => {
	const url = new URL(c.req.url);
	url.search = "";
	return withEdgeCache(
		url.toString(),
		SUMMARY_TTL,
		(p) => c.executionCtx.waitUntil(p),
		async () => {
			const sql = createPgClient(c.env);
			try {
				const [
					latestRunRows,
					run24hRows,
					eventCountsRows,
					fw7dRows,
					fw30dRows,
					kind7dRows,
					kind30dRows,
					dailyRows,
					weeklyRows,
				] = await Promise.all([
					sql<
						{
							completed_at: string;
							sweep_source: "radar" | "sweep" | "videos";
							duration_ms: number;
						}[]
					>`
					SELECT completed_at, sweep_source, duration_ms::int
					FROM collector_run_logs
					ORDER BY completed_at DESC
					LIMIT 1
				`,
					sql<
						{
							scanned_24h: number;
							not_modified_24h: number;
							radar_runs_24h: number;
							sweep_runs_24h: number;
						}[]
					>`
					SELECT COALESCE(SUM(claimed), 0)::int AS scanned_24h,
					       COALESCE(SUM(not_modified), 0)::int AS not_modified_24h,
					       COUNT(*) FILTER (WHERE sweep_source = 'radar')::int AS radar_runs_24h,
					       COUNT(*) FILTER (WHERE sweep_source = 'sweep')::int AS sweep_runs_24h
					FROM collector_run_logs
					WHERE completed_at >= now() - interval '24 hours'
				`,
					sql<{ changed_24h: number; changed_7d: number }[]>`
					SELECT COUNT(*) FILTER (WHERE detected_at >= now() - interval '24 hours')::int AS changed_24h,
					       COUNT(*) FILTER (WHERE detected_at >= now() - interval '7 days')::int AS changed_7d
					FROM doc_change_events
				`,
					sql<{ framework: string; count: number }[]>`
					SELECT framework, COUNT(*)::int AS count
					FROM doc_change_events
					WHERE detected_at >= now() - interval '7 days'
					GROUP BY framework
					ORDER BY count DESC, framework ASC
					LIMIT 12
				`,
					sql<{ framework: string; count: number }[]>`
					SELECT framework, COUNT(*)::int AS count
					FROM doc_change_events
					WHERE detected_at >= now() - interval '30 days'
					GROUP BY framework
					ORDER BY count DESC, framework ASC
					LIMIT 12
				`,
					sql<{ change_kind: string; count: number }[]>`
					SELECT change_kind, COUNT(*)::int AS count
					FROM doc_change_events
					WHERE detected_at >= now() - interval '7 days'
					GROUP BY change_kind
				`,
					sql<{ change_kind: string; count: number }[]>`
					SELECT change_kind, COUNT(*)::int AS count
					FROM doc_change_events
					WHERE detected_at >= now() - interval '30 days'
					GROUP BY change_kind
				`,
					sql<DocChangeDigest[]>`
					SELECT id::int, period_type, period_key, window_start, window_end, status,
					       provider, model, neurons_estimated::int, stats, content_en, content_zh, generated_at
					FROM doc_change_digests
					WHERE period_type = 'daily'
					ORDER BY period_key DESC
					LIMIT 1
				`,
					sql<DocChangeDigest[]>`
					SELECT id::int, period_type, period_key, window_start, window_end, status,
					       provider, model, neurons_estimated::int, stats, content_en, content_zh, generated_at
					FROM doc_change_digests
					WHERE period_type = 'weekly'
					ORDER BY period_key DESC
					LIMIT 1
				`,
				]);

				const latestRun = latestRunRows[0];
				const run24h = run24hRows[0];
				const eventCounts = eventCountsRows[0];

				const data: UpdatesSummaryResponse = {
					heartbeat: {
						last_run_at: latestRun?.completed_at ?? null,
						last_sweep_source: latestRun?.sweep_source ?? null,
						last_duration_ms: latestRun?.duration_ms ?? null,
						scanned_24h: run24h?.scanned_24h ?? 0,
						not_modified_24h: run24h?.not_modified_24h ?? 0,
						changed_24h: eventCounts?.changed_24h ?? 0,
						changed_7d: eventCounts?.changed_7d ?? 0,
						radar_runs_24h: run24h?.radar_runs_24h ?? 0,
						sweep_runs_24h: run24h?.sweep_runs_24h ?? 0,
					},
					latest_daily: dailyRows[0] ?? null,
					latest_weekly: weeklyRows[0] ?? null,
					top_frameworks_7d: fw7dRows,
					top_frameworks_30d: fw30dRows,
					by_kind_7d: Object.fromEntries(kind7dRows.map((r) => [r.change_kind, r.count])),
					by_kind_30d: Object.fromEntries(kind30dRows.map((r) => [r.change_kind, r.count])),
					generated_at: new Date().toISOString(),
				};

				return new Response(JSON.stringify({ success: true, data }), {
					headers: {
						"Content-Type": "application/json; charset=utf-8",
						"Cache-Control": `public, max-age=${SUMMARY_TTL}, s-maxage=${SUMMARY_TTL}, stale-while-revalidate=60`,
					},
				});
			} catch (error) {
				console.error(
					`Updates summary query failed: ${error instanceof Error ? error.message : String(error)}`,
				);
				return c.json(
					{
						success: false,
						error: { code: ApiErrorCode.INTERNAL_ERROR, message: "Failed to load updates summary" },
					},
					500,
				);
			} finally {
				await sql.end().catch(() => {});
			}
		},
	);
});

app.get("/feed", async (c) => {
	const rawFramework = c.req.query("framework")?.trim() || null;
	const rawKind = c.req.query("kind")?.trim() || null;
	const kind = rawKind && VALID_KINDS.has(rawKind) ? (rawKind as DocChangeKind) : null;
	const significance = c.req.query("significance")?.trim() || "important";
	const days = Math.min(90, Math.max(1, Number.parseInt(c.req.query("days") || "30", 10) || 30));
	const q = c.req.query("q")?.trim().slice(0, 120) || null;
	const limit = Math.min(50, Math.max(1, Number.parseInt(c.req.query("limit") || "25", 10) || 25));
	const offset = Math.min(
		5000,
		Math.max(0, Number.parseInt(c.req.query("offset") || "0", 10) || 0),
	);

	const shouldCache = !q && offset === 0;
	const runQuery = async (): Promise<Response> => {
		const sql = createPgClient(c.env);
		try {
			const cutoff = new Date(Date.now() - days * 86_400_000);
			const sigValues =
				significance === "all"
					? ["high", "medium", "low"]
					: significance === "high"
						? ["high"]
						: significance === "medium"
							? ["medium"]
							: significance === "low"
								? ["low"]
								: ["high", "medium"];
			const likePattern = q ? `%${escapeLike(q)}%` : null;

			const [countRows, events] = await Promise.all([
				sql<{ total: number }[]>`
					SELECT COUNT(*)::int AS total
					FROM doc_change_events
					WHERE detected_at >= ${cutoff}
					  AND significance = ANY(${sigValues}::text[])
					  AND (${rawFramework}::text IS NULL OR framework = ${rawFramework})
					  AND (${kind}::text IS NULL OR change_kind = ${kind})
					  AND (
						${likePattern}::text IS NULL
						OR title ILIKE ${likePattern} ESCAPE '\'
						OR framework ILIKE ${likePattern} ESCAPE '\'
						OR summary ILIKE ${likePattern} ESCAPE '\'
						OR url ILIKE ${likePattern} ESCAPE '\'
					  )
				`,
				sql<DocChangeEventItem[]>`
					SELECT id::int, url, framework, title, symbol_kind, change_kind, significance,
					       sweep_source, summary, change_flags, diff_snippet, source_modified_at, detected_at
					FROM doc_change_events
					WHERE detected_at >= ${cutoff}
					  AND significance = ANY(${sigValues}::text[])
					  AND (${rawFramework}::text IS NULL OR framework = ${rawFramework})
					  AND (${kind}::text IS NULL OR change_kind = ${kind})
					  AND (
						${likePattern}::text IS NULL
						OR title ILIKE ${likePattern} ESCAPE '\'
						OR framework ILIKE ${likePattern} ESCAPE '\'
						OR summary ILIKE ${likePattern} ESCAPE '\'
						OR url ILIKE ${likePattern} ESCAPE '\'
					  )
					ORDER BY detected_at DESC, id DESC
					LIMIT ${limit}
					OFFSET ${offset}
				`,
			]);

			const total = countRows[0]?.total ?? 0;
			return new Response(
				JSON.stringify({
					success: true,
					data: {
						events,
						total,
						has_more: offset + events.length < total,
					},
				}),
				{
					headers: {
						"Content-Type": "application/json; charset=utf-8",
						"Cache-Control": shouldCache
							? `public, max-age=${FEED_TTL}, s-maxage=${FEED_TTL}, stale-while-revalidate=60`
							: "no-store",
					},
				},
			);
		} catch (error) {
			console.error(
				`Updates feed query failed: ${error instanceof Error ? error.message : String(error)}`,
			);
			return c.json(
				{
					success: false,
					error: { code: ApiErrorCode.INTERNAL_ERROR, message: "Failed to load updates feed" },
				},
				500,
			);
		} finally {
			await sql.end().catch(() => {});
		}
	};

	if (shouldCache) {
		return withEdgeCache(c.req.url, FEED_TTL, (p) => c.executionCtx.waitUntil(p), runQuery);
	}
	return runQuery();
});

app.get("/digests", async (c) => {
	const period = c.req.query("period") === "weekly" ? "weekly" : "daily";
	const limit = Math.min(30, Math.max(1, Number.parseInt(c.req.query("limit") || "14", 10) || 14));
	return withEdgeCache(
		c.req.url,
		SUMMARY_TTL,
		(p) => c.executionCtx.waitUntil(p),
		async () => {
			const sql = createPgClient(c.env);
			try {
				const digests = await sql<DocChangeDigest[]>`
				SELECT id::int, period_type, period_key, window_start, window_end, status,
				       provider, model, neurons_estimated::int, stats, content_en, content_zh, generated_at
				FROM doc_change_digests
				WHERE period_type = ${period}
				ORDER BY period_key DESC
				LIMIT ${limit}
			`;
				return new Response(JSON.stringify({ success: true, data: { digests } }), {
					headers: {
						"Content-Type": "application/json; charset=utf-8",
						"Cache-Control": `public, max-age=${SUMMARY_TTL}, s-maxage=${SUMMARY_TTL}, stale-while-revalidate=60`,
					},
				});
			} catch (error) {
				console.error(
					`Digests query failed: ${error instanceof Error ? error.message : String(error)}`,
				);
				return c.json(
					{
						success: false,
						error: { code: ApiErrorCode.INTERNAL_ERROR, message: "Failed to load digests" },
					},
					500,
				);
			} finally {
				await sql.end().catch(() => {});
			}
		},
	);
});

app.get("/rss.xml", async (c) => {
	const url = new URL(c.req.url);
	url.search = "";
	return withEdgeCache(
		url.toString(),
		SYNDICATION_TTL,
		(p) => c.executionCtx.waitUntil(p),
		async () => {
			const sql = createPgClient(c.env);
			try {
				const [digests, events] = await Promise.all([
					sql<DocChangeDigest[]>`
						SELECT id::int, period_type, period_key, window_start, window_end, status,
						       provider, model, neurons_estimated::int, stats, content_en, content_zh, generated_at
						FROM doc_change_digests
						ORDER BY generated_at DESC
						LIMIT 5
					`,
					sql<DocChangeEventItem[]>`
						SELECT id::int, url, framework, title, symbol_kind, change_kind, significance,
						       sweep_source, summary, change_flags, diff_snippet, source_modified_at, detected_at
						FROM doc_change_events
						WHERE significance IN ('high', 'medium')
						ORDER BY detected_at DESC, id DESC
						LIMIT 40
					`,
				]);

				const xml = renderUpdatesRssXml(digests, events);
				return new Response(xml, {
					headers: {
						"Content-Type": "application/rss+xml; charset=utf-8",
						"Cache-Control": `public, max-age=${SYNDICATION_TTL}, s-maxage=${SYNDICATION_TTL}`,
					},
				});
			} catch (error) {
				console.error(
					`RSS feed query failed: ${error instanceof Error ? error.message : String(error)}`,
				);
				return c.text("Failed to generate RSS feed", 500);
			} finally {
				await sql.end().catch(() => {});
			}
		},
	);
});

app.get("/feed.json", async (c) => {
	const url = new URL(c.req.url);
	url.search = "";
	return withEdgeCache(
		url.toString(),
		SYNDICATION_TTL,
		(p) => c.executionCtx.waitUntil(p),
		async () => {
			const sql = createPgClient(c.env);
			try {
				const [digests, events] = await Promise.all([
					sql<DocChangeDigest[]>`
						SELECT id::int, period_type, period_key, window_start, window_end, status,
						       provider, model, neurons_estimated::int, stats, content_en, content_zh, generated_at
						FROM doc_change_digests
						ORDER BY generated_at DESC
						LIMIT 5
					`,
					sql<DocChangeEventItem[]>`
						SELECT id::int, url, framework, title, symbol_kind, change_kind, significance,
						       sweep_source, summary, change_flags, diff_snippet, source_modified_at, detected_at
						FROM doc_change_events
						WHERE significance IN ('high', 'medium')
						ORDER BY detected_at DESC, id DESC
						LIMIT 40
					`,
				]);

				const feed = {
					version: "https://jsonfeed.org/version/1.1",
					title: "Apple RAG — Apple Developer Docs Pulse",
					home_page_url: `${SITE_ORIGIN}/updates`,
					feed_url: `${SITE_ORIGIN}/api/updates/feed.json`,
					description:
						"Live Apple Developer Documentation change radar, structured diffs, and AI trend digests.",
					items: [
						...digests.map((d) => ({
							id: `apple-rag-digest:${d.period_type}:${d.period_key}`,
							url: `${SITE_ORIGIN}/updates/digest/${encodeURIComponent(d.period_type)}/${encodeURIComponent(d.period_key)}`,
							title: `[${d.period_type === "weekly" ? "Weekly" : "Daily"} Digest] ${d.content_en.headline}`,
							content_text: [d.content_en.overview, ...d.content_en.strategy_notes].join("\n\n"),
							date_published: new Date(d.generated_at).toISOString(),
							tags: [d.period_type, ...d.stats.top_frameworks.slice(0, 4).map((f) => f.framework)],
						})),
						...events.map((e) => ({
							id: `apple-rag-event:${e.id}`,
							url: e.url,
							title: `[${e.framework}] [${e.change_kind}] ${e.title}`,
							content_text: e.diff_snippet ? `${e.summary}\n\n${e.diff_snippet}` : e.summary,
							date_published: new Date(e.detected_at).toISOString(),
							tags: [e.framework, e.change_kind, e.significance],
						})),
					],
				};

				return new Response(JSON.stringify(feed), {
					headers: {
						"Content-Type": "application/feed+json; charset=utf-8",
						"Cache-Control": `public, max-age=${SYNDICATION_TTL}, s-maxage=${SYNDICATION_TTL}`,
					},
				});
			} catch (error) {
				console.error(
					`JSON feed query failed: ${error instanceof Error ? error.message : String(error)}`,
				);
				return c.json({ error: "Failed to generate JSON feed" }, 500);
			} finally {
				await sql.end().catch(() => {});
			}
		},
	);
});

export default app;
