import type postgres from "postgres";
import type { DocSweepSource } from "../../shared/doc-updates.js";
import { readCorpusStats } from "../shared/corpus-stats.js";
import {
	isTransientPostgresConnectionError,
	retryTransientPostgres,
} from "../shared/postgres-retry.js";
import type { DetectedDocChange } from "./change-detector.js";
import type { DatabaseRecord } from "./types/index.js";
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

	async getBatchRecords(batchSize: number, ids?: string[]): Promise<DatabaseRecord[]> {
		if (ids)
			return this.sql<DatabaseRecord[]>`
            WITH targets AS (SELECT id FROM pages WHERE id=ANY(${ids}::uuid[]) AND url LIKE 'https://developer.apple.com/%' ORDER BY id FOR UPDATE)
            UPDATE pages SET collect_count=collect_count+1 WHERE id IN (SELECT id FROM targets)
            RETURNING id,url,title,content,raw_json,http_etag,collect_count,created_at,updated_at`;
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
      RETURNING id, url, title, content, raw_json, http_etag, collect_count, created_at, updated_at
    `;
	}

	async getRadarBatchRecords(batchSize: number): Promise<DatabaseRecord[]> {
		return this.withRetry(
			"radar batch claim",
			(sql) =>
				sql<DatabaseRecord[]>`
        WITH radar_targets AS (
          SELECT id FROM pages
          WHERE (
            url ~ '^https://developer\\.apple\\.com/documentation/[^/]+$'
            OR url LIKE 'https://developer.apple.com/documentation/%-release-notes%'
            OR url LIKE 'https://developer.apple.com/documentation/updates%'
          )
            AND (radar_checked_at IS NULL OR radar_checked_at < now() - interval '45 minutes')
          ORDER BY radar_checked_at ASC NULLS FIRST, url ASC
          LIMIT ${batchSize}
          FOR UPDATE SKIP LOCKED
        )
        UPDATE pages
        SET collect_count = collect_count + 1,
            radar_checked_at = now()
        WHERE id IN (SELECT id FROM radar_targets)
        RETURNING id, url, title, content, raw_json, http_etag, collect_count, created_at, updated_at
      `,
		);
	}

	async updateHttpMetadata(
		records: Array<{
			id: string;
			collect_count: number;
			etag: string | null;
			sourceModifiedAt: Date | null;
		}>,
	): Promise<void> {
		const valid = records.filter((r) => r.etag || r.sourceModifiedAt);
		if (!valid.length) return;
		await this.withTransaction("update HTTP cache metadata", async (sql: postgres.Sql) => {
			for (const r of valid) {
				await sql`
          UPDATE pages
          SET http_etag = COALESCE(${r.etag}, http_etag),
              source_modified_at = COALESCE(${r.sourceModifiedAt}, source_modified_at)
          WHERE id = ${r.id} AND collect_count = ${r.collect_count}
        `;
			}
		});
	}

	async recordChangeEvents(events: readonly DetectedDocChange[]): Promise<number> {
		if (!events.length) return 0;
		return this.withTransaction("record doc change events", async (sql: postgres.Sql) => {
			let inserted = 0;
			for (const event of events) {
				await sql`
          INSERT INTO doc_change_events (
            url, framework, title, symbol_kind, change_kind, significance,
            sweep_source, summary, change_flags, diff_snippet, source_modified_at
          ) VALUES (
            ${event.url},
            ${event.framework},
            ${event.title},
            ${event.symbol_kind},
            ${event.change_kind},
            ${event.significance},
            ${event.sweep_source},
            ${event.summary},
            ${JSON.stringify(event.change_flags)}::jsonb,
            ${event.diff_snippet},
            ${event.source_modified_at}
          )
        `;
				inserted++;
			}
			return inserted;
		});
	}

	async recordCollectorRun(run: {
		startedAt: Date;
		durationMs: number;
		sweepSource: Exclude<DocSweepSource, "backfill">;
		claimed: number;
		notModified: number;
		updated: number;
		unchanged: number;
		added: number;
		deleted: number;
		failed: number;
		eventsRecorded: number;
	}): Promise<void> {
		await this.withRetry("record collector run log", async (sql) => {
			await sql`
        INSERT INTO collector_run_logs (
          started_at, duration_ms, sweep_source, claimed, not_modified,
          updated, unchanged, added, deleted, failed, events_recorded
        ) VALUES (
          ${run.startedAt},
          ${Math.max(0, Math.round(run.durationMs))},
          ${run.sweepSource},
          ${run.claimed},
          ${run.notModified},
          ${run.updated},
          ${run.unchanged},
          ${run.added},
          ${run.deleted},
          ${run.failed},
          ${run.eventsRecorded}
        )
      `;
		});
	}

	getStats() {
		return this.withRetry("statistics", readCorpusStats);
	}

	async getChunkLayout(urls: string[]) {
		return this.withRetry(
			"read chunk layout",
			(sql) => sql<
				{
					url: string;
					content: string;
					title: string | null;
					chunk_index: number;
					total_chunks: number;
					indexed: boolean;
				}[]
			>`
            SELECT url,content,title,chunk_index,total_chunks,embedding IS NOT NULL AS indexed
            FROM chunks WHERE url=ANY(${urls}) ORDER BY url,chunk_index`,
		);
	}

	async updateRawDocuments(
		records: { id: string; collect_count: number; json: string }[],
	): Promise<void> {
		await this.withTransaction("refresh documentation metadata", async (sql) => {
			for (const r of records)
				await sql`UPDATE pages SET raw_json=${r.json}::text::jsonb,updated_at=now()
                 WHERE id=${r.id} AND collect_count=${r.collect_count} AND raw_json IS DISTINCT FROM ${r.json}::text::jsonb AND raw_json IS DISTINCT FROM to_jsonb(${r.json}::text)`;
		});
	}

	async batchUpdateFullRecords(
		records: Array<
			DatabaseRecord & {
				raw_json: string | null;
				http_etag?: string | null;
				source_modified_at?: Date | null;
			}
		>,
		chunks: Array<{
			url: string;
			title: string | null;
			content: string;
			embedding: number[];
			chunk_index: number;
			total_chunks: number;
		}>,
	): Promise<string[]> {
		if (!records.length) return [];
		return this.withTransaction("page updates", async (sql: postgres.Sql) => {
			const locked = await this.lockCurrent(sql, records);
			if (!locked.length) return [];
			const urls = new Set(locked.map((row) => row.url));
			await sql`DELETE FROM chunks WHERE url=ANY(${[...urls]})`;
			for (const chunk of chunks) {
				if (urls.has(chunk.url))
					await sql`INSERT INTO chunks(url,title,content,embedding,chunk_index,total_chunks) VALUES(${chunk.url},${chunk.title},${chunk.content},${`[${chunk.embedding.join(",")}]`},${chunk.chunk_index},${chunk.total_chunks})`;
			}
			for (const record of records) {
				if (urls.has(record.url))
					await sql`UPDATE pages SET raw_json=${record.raw_json}::text::jsonb,title=${record.title},content=${record.content},http_etag=COALESCE(${record.http_etag ?? null}, http_etag),source_modified_at=COALESCE(${record.source_modified_at ?? null}, source_modified_at),updated_at=${record.updated_at} WHERE id=${record.id}`;
			}
			return [...urls];
		});
	}

	private lockCurrent(
		sql: postgres.Sql,
		records: readonly Pick<DatabaseRecord, "id" | "collect_count">[],
	) {
		return sql<{ id: string; url: string }[]>`SELECT p.id,p.url FROM pages p
            JOIN unnest(${records.map((r) => r.id)}::uuid[],${records.map((r) => r.collect_count)}::int[]) AS claims(id,generation)
            ON p.id=claims.id AND p.collect_count=claims.generation ORDER BY p.id FOR UPDATE OF p`;
	}

	async deleteRecords(
		records: readonly Pick<DatabaseRecord, "id" | "collect_count">[],
	): Promise<number> {
		if (!records.length) return 0;
		return this.withTransaction("permanent URL deletion", async (sql: postgres.Sql) => {
			const current = await this.lockCurrent(sql, records);
			await sql`DELETE FROM chunks WHERE url=ANY(${current.map((row) => row.url)})`;
			return (await sql`DELETE FROM pages WHERE id=ANY(${current.map((row) => row.id)})`).count;
		});
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
