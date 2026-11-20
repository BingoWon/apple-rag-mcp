import postgres from "postgres";
import { readCorpusStats } from "../shared/corpus-stats.js";
import {
	isTransientPostgresConnectionError,
	retryTransientPostgres,
} from "../shared/postgres-retry.js";
import type { Env } from "../shared/types.js";
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

export function collectorConnection(
	env: Pick<
		Env,
		| "RAG_DB_HOST"
		| "RAG_DB_PORT"
		| "RAG_DB_DATABASE"
		| "RAG_DB_USER"
		| "RAG_DB_PASSWORD"
		| "RAG_DB_SSLMODE"
	>,
	applicationName = "apple-rag-collector",
) {
	return postgres({
		host: env.RAG_DB_HOST,
		port: Number(env.RAG_DB_PORT) || 5432,
		database: env.RAG_DB_DATABASE,
		username: env.RAG_DB_USER,
		password: env.RAG_DB_PASSWORD,
		ssl: env.RAG_DB_SSLMODE === "require",
		max: 1,
		idle_timeout: 0,
		connect_timeout: 60,
		keep_alive: 30,
		connection: { ...COLLECTOR_CONNECTION_PARAMETERS, application_name: applicationName },
		transform: { undefined: null },
		onnotice: () => {},
	});
}

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
            SELECT incoming.url, 0
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
		if (!Number.isSafeInteger(batchSize) || batchSize < 1)
			throw Error("Invalid collector batch size");
		const sql = this.sql;
		const targets = ids
			? sql`SELECT id FROM pages WHERE id=ANY(${ids}::uuid[]) AND url LIKE 'https://developer.apple.com/%' ORDER BY id FOR UPDATE`
			: sql`
            WITH priority AS MATERIALIZED (
                SELECT id FROM pages WHERE url LIKE 'https://developer.apple.com/%' AND next_check_at<=now()
                AND last_outcome IN ('new','updated','retry')
                ORDER BY next_check_at,id LIMIT ${Math.ceil(batchSize / 3)} FOR UPDATE SKIP LOCKED
            ), rest AS (
                SELECT id FROM pages WHERE url LIKE 'https://developer.apple.com/%' AND next_check_at<=now()
                AND id NOT IN (SELECT id FROM priority)
                ORDER BY next_check_at,id LIMIT (${batchSize} - (SELECT count(*) FROM priority)) FOR UPDATE SKIP LOCKED
            ) SELECT id FROM priority UNION ALL SELECT id FROM rest`;
		return sql<DatabaseRecord[]>`WITH targets AS (${targets}) UPDATE pages
            SET collect_count=collect_count+1,next_check_at=now()+interval '15 minutes'
            WHERE id IN (SELECT id FROM targets)
            RETURNING id,url,title,content,collect_count,created_at,updated_at`;
	}

	async recordChecks(
		checks: {
			record: DatabaseRecord;
			outcome: "unchanged" | "retry" | "unavailable";
		}[],
	) {
		if (!checks.length) return [];
		const checkedAt = new Date();
		return this.withRetry(
			"record collection checks",
			(sql) => sql<{ url: string }[]>`
            UPDATE pages p SET last_checked_at=${checkedAt},
                last_success_at=CASE WHEN c.outcome='unchanged' THEN ${checkedAt} ELSE p.last_success_at END,
                last_outcome=c.outcome,
                next_check_at=${checkedAt}::timestamptz + CASE c.outcome
                    WHEN 'unchanged' THEN interval '45 days'
                    WHEN 'unavailable' THEN interval '45 days' ELSE interval '1 hour' END
            FROM unnest(${checks.map((c) => c.record.id)}::uuid[],${checks.map((c) => c.record.collect_count)}::int[],
                ${checks.map((c) => c.outcome)}::text[]) c(id,generation,outcome)
            WHERE p.id=c.id AND p.collect_count=c.generation RETURNING p.url`,
		);
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
		records: Array<DatabaseRecord & { raw_json: string | null }>,
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
					await sql`UPDATE pages SET raw_json=${record.raw_json}::text::jsonb,title=${record.title},content=${record.content},updated_at=${record.updated_at},
                          last_checked_at=now(),last_success_at=now(),last_outcome='updated',next_check_at=now()+interval '7 days' WHERE id=${record.id}`;
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
