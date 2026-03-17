/**
 * PostgreSQL Database Service with pgvector
 * Optimized for Cloudflare Workers with external database connection
 */
import postgres from "postgres";
import type { AppConfig, SearchOptions, SearchResult } from "../mcp-types/index.js";
import { logger } from "../mcp-utils/logger.js";

export class DatabaseService {
	private sql: ReturnType<typeof postgres>;
	constructor(config: AppConfig) {
		// Direct PostgreSQL connection - no checks, no logs
		this.sql = postgres({
			host: config.RAG_DB_HOST,
			port: config.RAG_DB_PORT,
			database: config.RAG_DB_DATABASE,
			username: config.RAG_DB_USER,
			password: config.RAG_DB_PASSWORD,
			ssl: config.RAG_DB_SSLMODE === "require",
			max: 5,
			idle_timeout: 60000,
			connect_timeout: 10000,
			prepare: true,
			connection: {
				application_name: "apple-rag-mcp",
			},
			transform: {
				undefined: null,
			},
		});
	}

	/**
	 * Initialize database - no checks, trust ready state
	 */
	async initialize(): Promise<void> {
		// Database assumed ready - no checks, no logs, instant return
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
			const results = await this.sql`
        SELECT id, url, title, content, chunk_index, total_chunks
        FROM chunks
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::halfvec
        LIMIT ${resultCount}
      `;

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
			const results = await this.sql`
        SELECT id, url, title, content, chunk_index, total_chunks
        FROM chunks
        WHERE to_tsvector('simple', COALESCE(title, '') || ' ' || content)
              @@ plainto_tsquery('simple', ${query})
        LIMIT ${resultCount}
      `;

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
			let results = await this.sql`
        SELECT id, url, title, content
        FROM pages
        WHERE url = ${normalizedUrl}
        LIMIT 1
      `;

			// If no exact match, try flexible matching
			if (results.length === 0) {
				// Try with/without trailing slash
				const alternativeUrl = normalizedUrl.endsWith("/")
					? normalizedUrl.slice(0, -1)
					: `${normalizedUrl}/`;

				results = await this.sql`
          SELECT id, url, title, content
          FROM pages
          WHERE url = ${alternativeUrl}
          LIMIT 1
        `;
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

	/**
	 * Close database connection
	 */
	async close(): Promise<void> {
		try {
			await this.sql.end();
		} catch (error) {
			logger.error(`Database close failed (operation: database_close): ${String(error)}`);
			// Don't re-throw - closing errors are not critical
		}
	}
}
