/**
 * PostgreSQL Database Service with pgvector
 * Optimized for Cloudflare Workers with external database connection
 */
import postgres from "postgres";
import type { BrowseInput } from "../../shared/browse.js";
import type { AppConfig, SearchOptions, SearchResult } from "../services/types.js";
import { logger } from "../shared/logger.js";
import { isTransientPostgresConnectionError } from "../shared/postgres-retry.js";
import { browseCatalog, type CatalogPage } from "./catalog.js";
import type { StoredWebPage } from "./page-reader.js";

export class DatabaseService {
	private sql: ReturnType<typeof postgres>;
	constructor(private config: AppConfig) {
		this.sql = this.createClient();
	}

	private createClient(): ReturnType<typeof postgres> {
		return postgres({
			host: this.config.RAG_DB_HOST,
			port: this.config.RAG_DB_PORT,
			database: this.config.RAG_DB_DATABASE,
			username: this.config.RAG_DB_USER,
			password: this.config.RAG_DB_PASSWORD,
			ssl: this.config.RAG_DB_SSLMODE === "require",
			max: 1,
			idle_timeout: 30,
			connect_timeout: 10,
			max_lifetime: 60 * 30,
			prepare: true,
			connection: {
				application_name: "apple-rag-mcp",
			},
			transform: {
				undefined: null,
			},
		});
	}

	private async withReconnect<T>(
		operation: (sql: ReturnType<typeof postgres>) => Promise<T>,
	): Promise<T> {
		try {
			return await operation(this.sql);
		} catch (error) {
			if (!isTransientPostgresConnectionError(error)) throw error;

			logger.warn(`PostgreSQL connection reset, rebuilding pool: ${String(error)}`);
			await this.sql.end({ timeout: 0 }).catch(() => {});
			this.sql = this.createClient();
			return operation(this.sql);
		}
	}

	/**
	 * Semantic search using vector similarity
	 */
	async semanticSearch(
		queryEmbedding: number[],
		options: SearchOptions = {},
	): Promise<SearchResult[]> {
		const { resultCount = 5 } = options;

		try {
			const results = await this.withReconnect(
				(sql) => sql`
	        SELECT id, url, title, content, chunk_index, total_chunks
	        FROM chunks
	        WHERE embedding IS NOT NULL
	        ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::halfvec
	        LIMIT ${resultCount}
	      `,
			);

			return results.map((row) => ({
				id: row.id as string,
				url: row.url as string,
				title: row.title as string | null,
				content: row.content as string,
				contentLength: (row.content as string).length,
				chunk_index: row.chunk_index as number,
				total_chunks: row.total_chunks as number,
			}));
		} catch (error) {
			logger.error(
				`Database semantic search failed (operation: semantic_search, embeddingDimensions: ${queryEmbedding.length}, resultCount: ${resultCount}): ${String(error)}`,
			);
			throw new Error(`Vector search failed: ${error}`);
		}
	}

	/**
	 * Keyword search optimized for Apple Developer Documentation
	 * Uses PostgreSQL 'simple' configuration for precise matching of technical terms,
	 * API names, and special symbols (@State, SecItemAdd, etc.)
	 */
	async keywordSearch(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
		const { resultCount = 5 } = options;

		try {
			const results = await this.withReconnect(
				(sql) => sql`
	        WITH exact AS MATERIALIZED (
 SELECT id,url,title,content,chunk_index,total_chunks FROM chunks
 WHERE chunk_index=0 AND title IS NOT NULL AND lower(split_part(regexp_replace(split_part(title, chr(10), 1), '^[^:]+: ', ''), '(', 1))=lower(split_part(trim(${query}::text),'(',1))
 ORDER BY length(url),url,id LIMIT ${resultCount}
 ), candidates AS MATERIALIZED (
 SELECT id,url,title,content,chunk_index,total_chunks FROM chunks
 WHERE to_tsvector('simple',COALESCE(title,'') || ' ' || content) @@ plainto_tsquery('simple',${query})
 AND (SELECT count(*) FROM exact)<${resultCount}
 LIMIT ${Math.max(64, resultCount * 8)}
 ), ranked AS (
 SELECT exact.*,true AS symbol,0::real AS score FROM exact
 UNION ALL
 SELECT c.*,false,ts_rank_cd(to_tsvector('simple',COALESCE(c.title,'') || ' ' || c.content),plainto_tsquery('simple',${query}))
 FROM candidates c WHERE NOT EXISTS(SELECT 1 FROM exact WHERE exact.id=c.id)
 )
 SELECT id,url,title,content,chunk_index,total_chunks FROM ranked
 ORDER BY symbol DESC,score DESC,length(url),url,chunk_index,id LIMIT ${resultCount}
	      `,
			);

			return results.map((row) => ({
				id: row.id as string,
				url: row.url as string,
				title: row.title as string | null,
				content: row.content as string,
				contentLength: (row.content as string).length,
				chunk_index: row.chunk_index as number,
				total_chunks: row.total_chunks as number,
			}));
		} catch (error) {
			logger.error(
				`Database keyword search failed (operation: keyword_search, query: ${query.substring(0, 50)}, resultCount: ${resultCount}): ${String(error)}`,
			);
			throw new Error(`Keyword search failed: ${error}`);
		}
	}

	/**
	 * Normalize URL for flexible matching
	 */
	private normalizeUrl(url: string): string {
		// Remove trailing slash
		let normalized = url.replace(/\/$/, "");

		// Ensure https:// prefix
		if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
			normalized = `https://${normalized}`;
		}

		// Convert http:// to https://
		if (normalized.startsWith("http://")) {
			normalized = normalized.replace("http://", "https://");
		}

		return normalized;
	}

	/**
	 * Get page content by URL from pages table with flexible matching
	 */
	async getPageByUrl(url: string): Promise<{
		id: string;
		url: string;
		title: string | null;
		content: string;
	} | null> {
		const normalizedUrl = this.normalizeUrl(url);

		try {
			// Try exact match first
			let results = await this.withReconnect(
				(sql) => sql`
	        SELECT id, url, title, content
	        FROM pages
	        WHERE url = ${normalizedUrl}
	        LIMIT 1
	      `,
			);

			// If no exact match, try flexible matching
			if (results.length === 0) {
				// Try with/without trailing slash
				const alternativeUrl = normalizedUrl.endsWith("/")
					? normalizedUrl.slice(0, -1)
					: `${normalizedUrl}/`;

				results = await this.withReconnect(
					(sql) => sql`
	          SELECT id, url, title, content
	          FROM pages
	          WHERE url = ${alternativeUrl}
	          LIMIT 1
	        `,
				);
			}

			if (results.length === 0) {
				return null;
			}

			const row = results[0];
			return {
				id: row.id as string,
				url: row.url as string,
				title: row.title as string | null,
				content: row.content as string,
			};
		} catch (error) {
			logger.error("Database page lookup failed");
			throw new Error("Page lookup failed", { cause: error });
		}
	}

	async browse(input: BrowseInput, signal: AbortSignal) {
		return this.withReconnect((sql) =>
			sql.begin("isolation level repeatable read read only", async (tx) => {
				await tx`SET LOCAL statement_timeout='5s'`;
				return browseCatalog(
					{
						pages: async (urls, offset, limit) => tx<CatalogPage[]>`
 SELECT n.url, n.readable, n.child_count AS count, n.digest, n.directory,
   COALESCE((
     SELECT jsonb_agg(jsonb_build_object('url', t.url, 'count', t.child_count, 'readable', t.readable) ORDER BY s.ord)
     FROM unnest(n.members[${offset + 1}:${offset + limit}]) WITH ORDINALITY s(url, ord)
     JOIN catalog_nodes t ON t.url = s.url
   ), '[]'::jsonb) AS members
 FROM catalog_nodes n WHERE n.url = ANY(${urls}::text[])
 `,
						sections: async (url, fragment) => tx<{ url: string; total: number }[]>`
 SELECT s.url, count(*) OVER()::integer AS total FROM catalog_nodes n
 CROSS JOIN LATERAL unnest(n.members) WITH ORDINALITY s(url,ord)
 WHERE n.url = ${url} AND strpos(s.url, '#') > 0
   AND strpos(lower(split_part(s.url, '#', 2)), lower(${encodeURIComponent(fragment)})) > 0
 ORDER BY ord LIMIT 10
 `,
						alias: async (url) => {
							const [alias] = await tx<{ canonical_url: string }[]>`
 SELECT a.canonical_url FROM web_page_aliases a JOIN catalog_nodes n ON n.url=a.canonical_url
 WHERE a.url=${url} AND a.expires_at>now()`;
							return alias?.canonical_url ?? null;
						},
					},
					input,
					signal,
				);
			}),
		);
	}
	async close(): Promise<void> {
		await this.sql.end({ timeout: 0 }).catch(() => {});
	}

	async getCachedPage(url: string): Promise<StoredWebPage | null> {
		const rows = await this.withReconnect(
			(sql) => sql`
			SELECT result FROM web_page_cache
			WHERE url = COALESCE((SELECT canonical_url FROM web_page_aliases
				WHERE url = ${url} AND expires_at > now()), ${url}) AND expires_at > now()
		`,
		);
		return (rows[0]?.result as StoredWebPage | undefined) ?? null;
	}

	async cachePage(requestedUrl: string, page: StoredWebPage): Promise<void> {
		await this.withReconnect((sql) =>
			sql.begin(async (tx) => {
				await tx`SET LOCAL lock_timeout = '2s'`;
				await tx`SELECT pg_advisory_xact_lock(782641)`;
				const ttl = page.status === 200 ? 86400 : 300;
				await tx`DELETE FROM web_page_cache WHERE expires_at <= now()`;
				await tx`DELETE FROM web_page_aliases WHERE expires_at <= now()`;
				await tx`INSERT INTO web_page_cache (url, result, expires_at, fetched_at)
				VALUES (${page.url}, ${tx.json({ ...page })}, now() + ${ttl} * interval '1 second', now())
				ON CONFLICT (url) DO UPDATE SET result = EXCLUDED.result,
					expires_at = EXCLUDED.expires_at, fetched_at = EXCLUDED.fetched_at`;
				if (requestedUrl !== page.url) {
					await tx`INSERT INTO web_page_aliases (url, canonical_url, expires_at)
					VALUES (${requestedUrl}, ${page.url}, now() + ${ttl} * interval '1 second')
					ON CONFLICT (url) DO UPDATE SET canonical_url = EXCLUDED.canonical_url,
						expires_at = EXCLUDED.expires_at`;
				}
				await tx`DELETE FROM web_page_cache WHERE url IN
				(SELECT url FROM web_page_cache ORDER BY fetched_at DESC, url OFFSET 500)`;
				await tx`DELETE FROM web_page_aliases WHERE url IN
				(SELECT url FROM web_page_aliases ORDER BY expires_at DESC, url OFFSET 1000)`;
			}),
		);
	}

	async reserveWebFetch(limit: number): Promise<boolean> {
		// Reservations are not replayed after connection errors: an uncertain charge stays consumed.
		const rows = await this.sql`INSERT INTO web_fetch_budget (day, attempts)
			SELECT (now() AT TIME ZONE 'UTC')::date, 1 WHERE ${limit} > 0
			ON CONFLICT (day) DO UPDATE SET attempts = web_fetch_budget.attempts + 1
			WHERE web_fetch_budget.attempts < ${limit} RETURNING attempts`;
		await this.sql`DELETE FROM web_fetch_budget WHERE day < (now() AT TIME ZONE 'UTC')::date - 7`;
		return rows.length > 0;
	}

	async enqueuePage(url: string): Promise<void> {
		await this.withReconnect(
			(sql) => sql`
			INSERT INTO pages (url, collect_count)
			VALUES (${url}, GREATEST(0, (SELECT COALESCE(MIN(collect_count), 1) - 1
				FROM pages WHERE url LIKE 'https://developer.apple.com/%' AND url <> ${url})))
			ON CONFLICT (url) DO UPDATE SET collect_count = LEAST(pages.collect_count, EXCLUDED.collect_count)
			WHERE COALESCE(pages.content, '') = ''
		`,
		);
	}
}
