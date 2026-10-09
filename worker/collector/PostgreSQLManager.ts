import type postgres from "postgres";
import {
	isTransientPostgresConnectionError,
	retryTransientPostgres,
} from "../shared/postgres-retry.js";
import type { DatabaseRecord, DatabaseStats } from "./types/index.js";
import { logger } from "./utils/logger.js";

export const COLLECTOR_CONNECTION_PARAMETERS = {
	application_name: "apple-rag-collector",
	statement_timeout: 120_000,
	lock_timeout: 60_000,
	idle_in_transaction_session_timeout: 180_000,
	tcp_user_timeout: 60_000,
	client_connection_check_interval: 1_000,
} as const;

function shouldRetryUrlInsert(error: unknown): boolean {
	const code = error && typeof error === "object" && "code" in error ? error.code : null;
	return (
		isTransientPostgresConnectionError(error) ||
		code === "55P03" ||
		code === "40P01" ||
		(code === "57014" && error instanceof Error && error.message.includes("statement timeout"))
	);
}

class PostgreSQLManager {
	private static readonly URL_INSERT_BATCH_SIZE = 1000;
	private sql: postgres.Sql;

	constructor(private readonly createClient: () => postgres.Sql) {
		this.sql = createClient();
	}

	private async withRetry<T>(
		stage: string,
		operation: (sql: postgres.Sql) => Promise<T>,
		shouldRetry = isTransientPostgresConnectionError,
	): Promise<T> {
		try {
			return await retryTransientPostgres(
				async () => {
					try {
						return await operation(this.sql);
					} catch (error) {
						if (isTransientPostgresConnectionError(error)) {
							// A failed transaction must finish on its old pool, never the retry's connection.
							await this.sql.end({ timeout: 0 }).catch(() => {});
							this.sql = this.createClient();
						}
						throw error;
					}
				},
				{
					shouldRetry,
					onRetry: ({ attempt, maxAttempts, delayMs, error }) => {
						logger.warn(
							`PostgreSQL ${stage} failed; retrying ${attempt}/${maxAttempts} in ${delayMs}ms: ${error instanceof Error ? error.message : String(error)}`,
						);
					},
				},
			);
		} catch (error) {
			throw new Error(
				`PostgreSQL ${stage} failed: ${error instanceof Error ? error.message : String(error)}`,
				{ cause: error },
			);
		}
	}

	// biome-ignore lint/suspicious/noExplicitAny: postgres.js TransactionSql generic type mismatch
	private async withTransaction<T>(stage: string, operation: (sql: any) => Promise<T>): Promise<T> {
		// Only replacements and deletions use this helper; counter-based claims are never replayed.
		return this.withRetry(stage, async (sql) => {
			return (await sql.begin(async (transaction) => operation(transaction))) as T;
		});
	}

	async batchInsertUrls(urls: string[]): Promise<number> {
		if (urls.length === 0) return 0;

		const minCollectCount = await this.withRetry("URL sync scheduling query", async (sql) => {
			// Query minimum collect_count from Apple Developer URLs (excluding 0)
			// This ensures new URLs integrate into normal scheduling without causing starvation
			const minResult = await sql`
          SELECT COALESCE(
            (SELECT MIN(collect_count)
             FROM pages
             WHERE url LIKE 'https://developer.apple.com/%'
             AND collect_count > 0),
            0
          ) as min
        `;
			return parseInt(minResult[0]?.min || "0", 10);
		});
		const newUrlCollectCount = Math.max(0, minCollectCount - 1);

		let insertedCount = 0;
		const batchCount = Math.ceil(urls.length / PostgreSQLManager.URL_INSERT_BATCH_SIZE);

		for (let offset = 0; offset < urls.length; offset += PostgreSQLManager.URL_INSERT_BATCH_SIZE) {
			const batchNumber = Math.floor(offset / PostgreSQLManager.URL_INSERT_BATCH_SIZE) + 1;
			const urlBatch = urls.slice(offset, offset + PostgreSQLManager.URL_INSERT_BATCH_SIZE);

			insertedCount += await this.withRetry(
				`URL sync batch ${batchNumber}/${batchCount}`,
				async (sql) => {
					// Existing rows can be read without waiting on another collector's row locks.
					const result = await sql`
            INSERT INTO pages (url, collect_count)
            SELECT incoming.url, ${newUrlCollectCount}
            FROM unnest(${urlBatch}::text[]) WITH ORDINALITY AS incoming(url, position)
            WHERE NOT EXISTS (
              SELECT 1 FROM pages existing WHERE existing.url = incoming.url
            )
              AND (
                incoming.url NOT LIKE 'https://developer.apple.com/%'
                OR NOT EXISTS (
                  SELECT 1 FROM pages existing
                  WHERE existing.url LIKE 'https://developer.apple.com/%'
                    AND lower(existing.url) = lower(incoming.url)
                )
              )
            ORDER BY
              CASE WHEN incoming.url LIKE 'https://developer.apple.com/%'
                THEN lower(incoming.url) ELSE incoming.url END,
              incoming.position
            ON CONFLICT DO NOTHING
          `;
					return result.count;
				},
				shouldRetryUrlInsert,
			);
		}

		return insertedCount;
	}

	async getBatchRecords(batchSize: number): Promise<DatabaseRecord[]> {
		// Atomic operation: SELECT records with minimum collect_count and UPDATE them
		// This ensures different workers get different records by always taking the minimum collect_count
		return this.sql<DatabaseRecord[]>`
      WITH min_count_records AS (
        SELECT id FROM pages
        WHERE url LIKE 'https://developer.apple.com/%'
          AND collect_count = (
            SELECT MIN(collect_count)
            FROM pages
            WHERE url LIKE 'https://developer.apple.com/%'
          )
        ORDER BY
          CASE WHEN content IS NULL OR content = '' THEN 0 ELSE 1 END ASC,
          CASE WHEN title IS NULL OR title = '' THEN 0 ELSE 1 END ASC,
          url ASC
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE pages
      SET collect_count = collect_count + 1
      WHERE id IN (SELECT id FROM min_count_records)
      RETURNING id, url, title, content, collect_count, created_at, updated_at
    `;
	}

	async getStats(): Promise<DatabaseStats> {
		const appleUrlPattern = "https://developer.apple.com/%";
		const videoUrlPattern = "https://developer.apple.com/videos/play/%";

		const [
			// Docs stats (non-video pages)
			docsTotal,
			docsCollected,
			// Videos stats
			videosTotal,
			videosCollected,
			// Combined stats
			avgResult,
			minMaxResult,
			distributionResult,
			chunksResult,
		] = await this.withRetry("statistics", (sql) =>
			Promise.all([
				sql`SELECT COUNT(*) as count FROM pages WHERE url LIKE ${appleUrlPattern} AND url NOT LIKE ${videoUrlPattern}`,
				sql`SELECT COUNT(*) as count FROM pages WHERE url LIKE ${appleUrlPattern} AND url NOT LIKE ${videoUrlPattern} AND collect_count > 0`,
				sql`SELECT COUNT(*) as count FROM pages WHERE url LIKE ${videoUrlPattern}`,
				sql`SELECT COUNT(*) as count FROM pages WHERE url LIKE ${videoUrlPattern} AND collect_count > 0`,
				sql`SELECT AVG(collect_count) as avg FROM pages WHERE url LIKE ${appleUrlPattern}`,
				sql`SELECT MIN(collect_count) as min, MAX(collect_count) as max FROM pages WHERE url LIKE ${appleUrlPattern}`,
				sql`SELECT collect_count, COUNT(*) as count FROM pages WHERE url LIKE ${appleUrlPattern} GROUP BY collect_count ORDER BY collect_count`,
				sql`SELECT COUNT(*) as count FROM chunks WHERE url LIKE ${appleUrlPattern}`,
			]),
		);

		const docsCount = parseInt(docsTotal[0]?.count || "0", 10);
		const docsCollectedCount = parseInt(docsCollected[0]?.count || "0", 10);
		const videosCount = parseInt(videosTotal[0]?.count || "0", 10);
		const videosCollectedCount = parseInt(videosCollected[0]?.count || "0", 10);

		const total = docsCount + videosCount;
		const collected = docsCollectedCount + videosCollectedCount;
		const avgCollectCount = parseFloat(avgResult[0]?.avg || "0");
		const minCollectCount = parseInt(minMaxResult[0]?.min || "0", 10);
		const maxCollectCount = parseInt(minMaxResult[0]?.max || "0", 10);
		const totalChunks = parseInt(chunksResult[0]?.count || "0", 10);

		// Helper: percentage with 1 decimal, floor
		const pct = (n: number, d: number) => (d > 0 ? `${Math.floor((n / d) * 1000) / 10}%` : "0%");

		const collectCountDistribution: Record<string, { count: number; percentage: string }> = {};
		distributionResult.forEach((row: Record<string, unknown>) => {
			const cc = String(row.collect_count);
			const count = parseInt(String(row.count), 10);
			collectCountDistribution[cc] = { count, percentage: pct(count, total) };
		});

		return {
			docs: {
				total: docsCount,
				collected: docsCollectedCount,
				collectedPercentage: pct(docsCollectedCount, docsCount),
			},
			videos: {
				total: videosCount,
				collected: videosCollectedCount,
				collectedPercentage: pct(videosCollectedCount, videosCount),
			},
			total,
			avgCollectCount: Math.round(avgCollectCount * 10000) / 10000,
			collectedCount: collected,
			collectedPercentage: pct(collected, total),
			maxCollectCount,
			minCollectCount,
			collectCountDistribution,
			totalChunks,
		};
	}

	async batchUpdateFullRecords(
		records: Array<DatabaseRecord & { readonly raw_json: string | null }>,
	): Promise<void> {
		if (records.length === 0) return;

		await this.withTransaction("page updates", async (sql) => {
			for (const record of records) {
				await sql`
          UPDATE pages
          SET raw_json = ${record.raw_json},
              title = ${record.title},
              content = ${record.content},
              updated_at = ${record.updated_at}
          WHERE id = ${record.id}
        `;
			}
		});
		logger.info(`📝 Updated full records: ${records.length} records`);
	}

	async deleteRecords(recordIds: string[]): Promise<void> {
		if (recordIds.length === 0) return;

		const deleted = await this.withTransaction("permanent URL deletion", async (sql) => {
			const chunksDeleteResult = await sql`
        DELETE FROM chunks
        WHERE url IN (SELECT url FROM pages WHERE id = ANY(${recordIds}))
      `;

			const pagesDeleteResult = await sql`
        DELETE FROM pages WHERE id = ANY(${recordIds})
      `;

			return { pages: pagesDeleteResult.count, chunks: chunksDeleteResult.count };
		});
		logger.info(
			`🗑️ Deleted permanent error records: ${deleted.pages} pages, ${deleted.chunks} chunks`,
		);
	}

	async insertChunks(
		chunks: Array<{
			url: string;
			title: string | null;
			content: string;
			embedding: number[];
			chunk_index: number;
			total_chunks: number;
		}>,
	): Promise<void> {
		if (chunks.length === 0) return;

		const urls = [...new Set(chunks.map((c) => c.url))];
		const deletedCount = await this.withTransaction("chunk replacement", async (sql) => {
			let deleted = 0;

			if (urls.length > 0) {
				const deleteResult = await sql`
          DELETE FROM chunks WHERE url = ANY(${urls})
        `;
				deleted = deleteResult.count || 0;
			}

			for (const chunk of chunks) {
				await sql`
          INSERT INTO chunks (url, title, content, embedding, chunk_index, total_chunks)
          VALUES (${chunk.url}, ${chunk.title}, ${chunk.content}, ${`[${chunk.embedding.join(",")}]`}, ${chunk.chunk_index}, ${chunk.total_chunks})
        `;
			}
			return deleted;
		});
		logger.info(`🗑️ Deleted ${deletedCount} existing chunks for ${urls.length} URLs`);
	}

	async close(): Promise<void> {
		try {
			await this.sql.end({ timeout: 0 });
		} catch (error) {
			if (!isTransientPostgresConnectionError(error)) throw error;
		}
	}
}

export { PostgreSQLManager };
