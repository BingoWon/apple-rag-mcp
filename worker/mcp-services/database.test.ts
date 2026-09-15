import assert from "node:assert/strict";
import test from "node:test";
import type postgres from "postgres";
import { DatabaseService } from "./database.js";
import { SearchEngine } from "./search-engine.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = {
	skip: !databaseUrl && "Set TEST_DATABASE_URL to run PostgreSQL integration tests",
};

function connect() {
	const url = new URL(databaseUrl!);
	const database = new DatabaseService({
		RAG_DB_HOST: url.hostname,
		RAG_DB_PORT: Number(url.port || 5432),
		RAG_DB_DATABASE: url.pathname.slice(1),
		RAG_DB_USER: decodeURIComponent(url.username),
		RAG_DB_PASSWORD: decodeURIComponent(url.password),
		RAG_DB_SSLMODE: "disable",
	});
	return { database, sql: Reflect.get(database, "sql") as postgres.Sql };
}

test(
	"bounded keyword retrieval preserves topics, exact matches and model-independent fallback",
	integration,
	async () => {
		const { database, sql } = connect();
		try {
			// Use only session-local fixtures, even when the supplied database contains application tables.
			await sql`SET search_path = pg_temp`;
			await sql`CREATE TEMP TABLE chunks (
			id text PRIMARY KEY, url text NOT NULL, title text, content text NOT NULL,
			chunk_index integer DEFAULT 0, total_chunks integer DEFAULT 1
		)`;
			await sql`CREATE INDEX ON chunks USING gin (
			to_tsvector('simple', COALESCE(title, '') || ' ' || content)
		)`;
			await sql`INSERT INTO chunks (id, url, title, content)
			SELECT 'noise-' || n, 'https://example.com/noise/' || n,
			'macOS iOS API SDK', repeat('macOS iOS iPhone API SDK core location CommonTopic ', 20)
			FROM generate_series(1, 1000) AS n`;
			await sql`INSERT INTO chunks (id, url, title, content) VALUES
			('edr', 'https://developer.apple.com/documentation/metal/edr', 'EDR displays', 'EDID peak luminance EDR headroom'),
			('alarm', 'https://developer.apple.com/documentation/alarmkit/alarmmanager', 'AlarmManager', 'AlarmKit scheduling and authorization'),
			('contacts', 'https://developer.apple.com/documentation/contacts', 'Contacts', 'CNSaveRequest addContact toContainerWithIdentifier nil'),
			('location', 'https://developer.apple.com/documentation/corelocation', 'Core Location', 'Core Location delivers location updates'),
			('exact', 'https://example.com/exact', NULL, 'unique exact sentinel'),
			('unrelated', 'https://example.com/unrelated', 'unique', 'A partial match must not displace an exact match')`;
			await sql`ANALYZE chunks`;

			const queries = [
				[
					"EDID external display peak luminance EDR headroom macOS how maximum potential headroom is determined",
					"edr",
				],
				["AlarmKit availability iOS version requirements AlarmManager authorization", "alarm"],
				[
					"CNSaveRequest addContact container identifier Contacts framework save request",
					"contacts",
				],
				["CNSaveRequest add contact toContainerWithIdentifier nil default container", "contacts"],
				["Core Location iOS 26 new API WWDC25 location updates", "location"],
				["display luminance unavailable words", "edr"],
			] as const;
			for (const [query, id] of queries) {
				const results = await database.keywordSearch(query, { resultCount: 16 });
				assert.ok(
					results.some((row) => row.id === id),
					query,
				);
				if (id === "location") assert.equal(results[0].id, id);
				else
					assert.ok(
						results.every((row) => !row.id.startsWith("noise-")),
						query,
					);
			}
			assert.deepEqual(
				(await database.keywordSearch("unique exact sentinel")).map((row) => row.id),
				["exact"],
			);
			assert.deepEqual(await database.keywordSearch("iOS 999999 SDK"), []);
			assert.deepEqual(await database.keywordSearch("nonexistentSymbolXYZ"), []);
			assert.deepEqual(await database.keywordSearch('" | & ! : ( )'), []);
			const bounded = await database.keywordSearch("CommonTopic MissingTopic", {
				resultCount: 1000,
			});
			assert.ok(
				bounded.length > 0 && bounded.length <= 256,
				"broad terms must be capped before scoring",
			);
			assert.equal((await sql`SELECT count(*)::int AS count FROM chunks`)[0].count, 1006);

			const engine = new SearchEngine(
				database,
				{
					createEmbedding: async () => {
						throw new Error("429 engine_overloaded");
					},
				} as never,
				{
					rerank: async () => {
						throw new Error("reranker unavailable");
					},
				} as never,
			);
			const result = await engine.search(queries[2][0], { resultCount: 4 });
			assert.ok(result.results.some((row) => row.id === "contacts"));
		} finally {
			await database.close();
		}
	},
);

test(
	"PostgreSQL cancels slow retrieval and the same connection remains usable",
	integration,
	async () => {
		const { database, sql } = connect();
		try {
			await sql`SET search_path = pg_temp`;
			const [before] =
				await sql`SELECT pg_backend_pid() AS pid, current_setting('statement_timeout') AS timeout`;
			assert.equal(before.timeout, "2s");
			await sql`CREATE TEMP VIEW chunks AS
			SELECT 'slow'::text AS id, 'https://example.com'::text AS url, 'EDR'::text AS title,
			'EDR'::text AS content, 0 AS chunk_index, 1 AS total_chunks FROM pg_sleep(5)`;
			const startedAt = Date.now();
			await assert.rejects(
				database.keywordSearch("EDR"),
				/canceling statement due to statement timeout/,
			);
			assert.ok(Date.now() - startedAt < 4000, "retrieval must not wait for pg_sleep to finish");
			const [after] = await sql`SELECT pg_backend_pid() AS pid`;
			assert.equal(
				after.pid,
				before.pid,
				"timeout must release the existing connection, not leave work running",
			);
			await sql`DROP VIEW chunks`;
		} finally {
			await database.close();
		}
	},
);
