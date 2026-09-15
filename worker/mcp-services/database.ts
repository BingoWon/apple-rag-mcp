/**
 * PostgreSQL Database Service with pgvector
 * Optimized for Cloudflare Workers with external database connection
 */
import postgres from "postgres";
import type { AppConfig, SearchOptions, SearchResult } from "../mcp-types/index.js";
import { logger } from "../mcp-utils/logger.js";
import { isTransientPostgresConnectionError } from "../shared/postgres-retry.js";

const KEYWORD_CANDIDATES_PER_TERM = 64;

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
				statement_timeout: 2_000,
				lock_timeout: 500,
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
		const startedAt = Date.now();
		let exactMs = 0;
		let terms: string[] = [];

		try {
			let results = await this.withReconnect(
				(sql) => sql`
	        SELECT id, url, title, content, chunk_index, total_chunks
	        FROM chunks
	        WHERE to_tsvector('simple', COALESCE(title, '') || ' ' || content)
	              @@ plainto_tsquery('simple', ${query})
	        LIMIT ${resultCount}
	      `,
			);
			exactMs = Date.now() - startedAt;

			if (results.length === 0) {
				terms = extractKeywordTerms(query);
				if (terms.length > 0) {
					const fallbackQuery = terms.map((term) => `"${term}"`).join(" OR ");
					results = await this.withReconnect((sql) => {
						// Include focused multi-term matches before broad single-term candidates.
						const queries = terms.length > 1 ? [terms.join(" "), ...terms] : terms;
						// ponytail: at most 256 candidates before ranking; expand only with recall evidence.
						const limit = Math.min(KEYWORD_CANDIDATES_PER_TERM, Math.floor(256 / queries.length));
						const candidates = queries
							.map(
								(term) => sql`(
									SELECT id FROM chunks
									WHERE to_tsvector('simple', COALESCE(title, '') || ' ' || content)
										@@ plainto_tsquery('simple', ${term})
									LIMIT ${limit}
								)`,
							)
							.reduce((left, right) => sql`${left} UNION ${right}`);

						return sql`
							WITH candidate_ids AS MATERIALIZED (${candidates})
							SELECT id, url, title, content, chunk_index, total_chunks
							FROM chunks JOIN candidate_ids USING (id)
							ORDER BY (
								to_tsvector('simple', COALESCE(title, '') || ' ' || content)
									@@ plainto_tsquery('simple', ${terms.join(" ")})
							) DESC, ts_rank(
								to_tsvector('simple', COALESCE(title, '') || ' ' || content),
								websearch_to_tsquery('simple', ${fallbackQuery})
							) DESC, id
							LIMIT ${resultCount}
						`;
					});
				}
			}

			logger.info(
				`Keyword retrieval: ${JSON.stringify({ exactMs, fallbackMs: Date.now() - startedAt - exactMs, terms, results: results.length })}`,
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
				`Database keyword search failed (operation: keyword_search, elapsedMs: ${Date.now() - startedAt}, query: ${query.substring(0, 50)}, resultCount: ${resultCount}): ${String(error)}`,
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
			logger.error(
				`Database page lookup failed (operation: page_lookup, url: ${url.substring(0, 100)}, normalizedUrl: ${this.normalizeUrl(url).substring(0, 100)}): ${String(error)}`,
			);
			throw new Error(`Page lookup failed: ${error}`);
		}
	}

	async close(): Promise<void> {
		await this.sql.end({ timeout: 0 }).catch(() => {});
	}
}

function extractKeywordTerms(query: string): string[] {
	const terms = (query.match(/[\p{L}\p{N}_]+/gu) ?? []).filter(
		(term) =>
			term.length > 1 &&
			/[\p{L}]/u.test(term) &&
			!KEYWORD_CONTEXT_TERMS.has(term.toLowerCase()) &&
			!/^wwdc\d*$/i.test(term),
	);
	const technicalTerms = terms.filter((term) => /^[a-z].*[A-Z]|^[A-Z].*[A-Z]/.test(term));
	const fallbackTerms = technicalTerms.length > 0 ? technicalTerms : terms;
	return [...new Set(fallbackTerms.map((term) => term.toLowerCase()))].slice(0, 8);
}

// Platform labels occur on most document titles; they are context, not independent topics.
const KEYWORD_CONTEXT_TERMS = new Set(
	"apple ios ipados macos tvos watchos visionos iphone ipad mac api sdk the and or for with from into how what when where which this that these those does using new".split(
		" ",
	),
);
