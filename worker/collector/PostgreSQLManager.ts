import type postgres from "postgres";
import type { DatabaseRecord, DatabaseStats } from "./types/index.js";
import { logger } from "./utils/logger.js";

class PostgreSQLManager {
	constructor(private readonly sql: postgres.Sql) {}

	private async withTransaction<T>(operation: (sql: postgres.Sql) => Promise<T>): Promise<T> {
		return (await this.sql.begin(async (sql) => {
			return await operation(sql);
		})) as T;
	}

	async batchInsertUrls(urls: string[]): Promise<number> {
		if (urls.length === 0) return 0;

		// Query minimum collect_count from Apple Developer URLs (excluding 0)
		// This ensures new URLs integrate into normal scheduling without causing starvation
		const minResult = await this.sql`
      SELECT COALESCE(
        (SELECT MIN(collect_count)
         FROM pages
         WHERE url LIKE 'https://developer.apple.com/%'
         AND collect_count > 0),
        0
      ) as min
    `;
		const minCollectCount = parseInt(minResult[0]?.min || "0", 10);

		const result = await this.sql`
      INSERT INTO pages ${this.sql(urls.map((url) => ({ url, collect_count: minCollectCount })))}
      ON CONFLICT (url) DO NOTHING
    `;

		return result.count;
	}

	async getBatchRecords(batchSize: number): Promise<DatabaseRecord[]> {
		// Atomic operation: SELECT records with minimum collect_count and UPDATE them
		// This ensures different workers get different records by always taking the minimum collect_count
		const result = await this.sql`
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
      RETURNING *
    `;

		return result.map((row: Record<string, unknown>) => ({
			...row,
			raw_json: row.raw_json === undefined ? null : row.raw_json, // Fix postgres JSONB undefined → null
			collect_count: Number(row.collect_count),
			created_at: row.created_at,
			updated_at: row.updated_at,
		})) as DatabaseRecord[];
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
		] = await Promise.all([
			this
				.sql`SELECT COUNT(*) as count FROM pages WHERE url LIKE ${appleUrlPattern} AND url NOT LIKE ${videoUrlPattern}`,
			this
				.sql`SELECT COUNT(*) as count FROM pages WHERE url LIKE ${appleUrlPattern} AND url NOT LIKE ${videoUrlPattern} AND collect_count > 0`,
			this.sql`SELECT COUNT(*) as count FROM pages WHERE url LIKE ${videoUrlPattern}`,
			this
				.sql`SELECT COUNT(*) as count FROM pages WHERE url LIKE ${videoUrlPattern} AND collect_count > 0`,
			this.sql`SELECT AVG(collect_count) as avg FROM pages WHERE url LIKE ${appleUrlPattern}`,
			this
				.sql`SELECT MIN(collect_count) as min, MAX(collect_count) as max FROM pages WHERE url LIKE ${appleUrlPattern}`,
			this
				.sql`SELECT collect_count, COUNT(*) as count FROM pages WHERE url LIKE ${appleUrlPattern} GROUP BY collect_count ORDER BY collect_count`,
			this.sql`SELECT COUNT(*) as count FROM chunks WHERE url LIKE ${appleUrlPattern}`,
		]);

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

	async batchUpdateFullRecords(records: DatabaseRecord[]): Promise<void> {
		if (records.length === 0) return;

		await this.withTransaction(async (sql) => {
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

			logger.info(`📝 Updated full records: ${records.length} records`);
		});
	}

	async deleteRecords(recordIds: string[]): Promise<void> {
		if (recordIds.length === 0) return;

		await this.withTransaction(async (sql) => {
			const chunksDeleteResult = await sql`
        DELETE FROM chunks
        WHERE url IN (SELECT url FROM pages WHERE id = ANY(${recordIds}))
      `;

			const pagesDeleteResult = await sql`
        DELETE FROM pages WHERE id = ANY(${recordIds})
      `;

			logger.info(
				`🗑️ Deleted permanent error records: ${pagesDeleteResult.count} pages, ${chunksDeleteResult.count} chunks`,
			);
		});
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

		await this.withTransaction(async (sql) => {
			const urls = [...new Set(chunks.map((c) => c.url))];

			if (urls.length > 0) {
				const deleteResult = await sql`
          DELETE FROM chunks WHERE url = ANY(${urls})
        `;
				logger.info(`🗑️ Deleted ${deleteResult.count || 0} existing chunks for ${urls.length} URLs`);
			}

			for (const chunk of chunks) {
				await sql`
          INSERT INTO chunks (url, title, content, embedding, chunk_index, total_chunks)
          VALUES (${chunk.url}, ${chunk.title}, ${chunk.content}, ${`[${chunk.embedding.join(",")}]`}, ${chunk.chunk_index}, ${chunk.total_chunks})
        `;
			}
		});
	}

	async close(): Promise<void> {
		await this.sql.end();
	}
}

export { PostgreSQLManager };
