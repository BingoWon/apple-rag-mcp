import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { AppleDocCollector } from "../../worker/collector/AppleDocCollector.ts";
import { ContentProcessor } from "../../worker/collector/ContentProcessor.ts";
import {
	collectorConnection,
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
const createClient = () => collectorConnection(process.env, "collector-targeted-recovery");
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
	const result = await collector.execute(ids);
	assert.equal(
		result.updated + result.unchanged,
		ids.length,
		"Every requested page must be recovered",
	);

	const recovered = await sql`SELECT id,url,title,content,collect_count,updated_at,
		raw_json #>> '{}' AS source_json FROM pages WHERE id = ANY(${ids}) ORDER BY url`;
	const processor = new ContentProcessor();
	const parsed = await processor.processDocuments(
		recovered
			.filter((record) => !record.url.startsWith("https://developer.apple.com/videos/play/"))
			.map((record) => ({ url: record.url, data: JSON.parse(record.source_json) })),
	);
	assert.equal(recovered.length, records.length);
	for (const record of recovered) {
		if (record.url.startsWith("https://developer.apple.com/videos/play/")) {
			assert.ok(record.content?.trim());
			continue;
		}
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
