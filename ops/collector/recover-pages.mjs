import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import postgres from "postgres";
import { AppleDocCollector } from "../../worker/collector/AppleDocCollector.ts";
import { ContentProcessor } from "../../worker/collector/ContentProcessor.ts";
import {
	COLLECTOR_CONNECTION_PARAMETERS,
	PostgreSQLManager,
} from "../../worker/collector/PostgreSQLManager.ts";

const [inputPath, outputPath] = process.argv.slice(2);
assert.ok(
	inputPath && outputPath,
	"Usage: tsx recover-pages.mjs <incident-records.json> <result.json>",
);
process.loadEnvFile(".dev.vars");
assert.ok(process.env.DEEPINFRA_API_KEY, "The collector embedding credential is required");
const { records: incidentRecords } = JSON.parse(readFileSync(inputPath, "utf8"));
const ids = [...new Set(incidentRecords.map((record) => record.id))];
assert.ok(ids.length > 0 && ids.length <= 50, "Recovery requires 1-50 explicit incident page IDs");
const createClient = () =>
	postgres({
		host: process.env.RAG_DB_HOST,
		port: Number(process.env.RAG_DB_PORT || "5432"),
		database: process.env.RAG_DB_DATABASE,
		username: process.env.RAG_DB_USER,
		password: process.env.RAG_DB_PASSWORD,
		ssl: process.env.RAG_DB_SSLMODE === "require",
		max: 1,
		idle_timeout: 0,
		connect_timeout: 60,
		connection: {
			...COLLECTOR_CONNECTION_PARAMETERS,
			application_name: "collector-targeted-recovery",
		},
		onnotice: () => {},
	});
const sql = createClient();
const manager = new PostgreSQLManager(createClient);
const started = new Date();
try {
	const records = await sql`SELECT id,url,title,content,collect_count,created_at,updated_at
		FROM pages WHERE id = ANY(${ids}) ORDER BY url`;
	assert.equal(records.length, ids.length, "Every incident page must still exist");
	const collector = new AppleDocCollector(manager, process.env.DEEPINFRA_API_KEY, {
		batchSize: records.length,
		forceUpdateAll: false,
	});
	// Reuse processing without claiming pages, so recovery never increments collect_count.
	const result = await collector.processBatch(records);
	assert.equal(result.failureRecords.length, 0, "Every recovery fetch must succeed");
	const recovered = await sql`SELECT id,url,title,content,collect_count,updated_at,
		raw_json #>> '{}' AS source_json FROM pages WHERE id = ANY(${ids}) ORDER BY url`;
	const processor = new ContentProcessor();
	const parsed = await processor.processDocuments(
		recovered.map((record) => ({ url: record.url, data: JSON.parse(record.source_json) })),
	);
	assert.equal(recovered.length, records.length);
	for (const record of recovered) {
		assert.equal(
			record.collect_count,
			records.find((before) => before.id === record.id).collect_count,
		);
		const expected = parsed.find((item) => item.url === record.url);
		assert.ok(expected?.data, `Stored JSON must parse for ${record.url}`);
		assert.equal(record.title, expected.data.title || null);
		assert.equal(record.content, expected.data.content || "");
	}
	const duplicates = await sql`SELECT url,chunk_index FROM chunks
		WHERE url = ANY(${recovered.map((record) => record.url)})
		GROUP BY url,chunk_index HAVING count(*) > 1`;
	assert.equal(duplicates.length, 0, "Recovery must not create duplicate chunks");
	const summary = {
		startedAt: started.toISOString(),
		completedAt: new Date().toISOString(),
		recoveredPages: recovered.length,
		generatedChunks: result.totalChunks,
		countersUnchanged: true,
		storedContentMatchesRawJson: true,
		duplicateChunks: 0,
		pages: recovered.map(({ id, url, collect_count, updated_at }) => ({
			id,
			url,
			collect_count,
			updated_at,
		})),
	};
	writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 });
	console.log(JSON.stringify({ ...summary, pages: undefined }));
} finally {
	await manager.close();
	await sql.end({ timeout: 0 }).catch(() => {});
}
