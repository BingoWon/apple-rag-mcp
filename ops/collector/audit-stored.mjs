import assert from "node:assert/strict";
import { parseArgs } from "node:util";
import { AppleDocCollector } from "../../worker/collector/AppleDocCollector.ts";
import { chunkText, matchesChunkLayout } from "../../worker/collector/Chunker.ts";
import { ContentProcessor } from "../../worker/collector/ContentProcessor.ts";
import {
	collectorConnection,
	PostgreSQLManager,
} from "../../worker/collector/PostgreSQLManager.ts";

const { values } = parseArgs({
	options: {
		after: { type: "string" },
		limit: { type: "string", default: "30" },
		apply: { type: "boolean", default: false },
	},
});
const limit = Number(values.limit);
assert.ok(Number.isSafeInteger(limit) && limit >= 1 && limit <= 1000, "Use a limit from 1 to 1000");
if (values.after) assert.match(values.after, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);
process.loadEnvFile(".dev.vars");
const connect = () => collectorConnection(process.env, "collector-stored-audit");
const sql = connect();
const db = new PostgreSQLManager(connect);
const processor = new ContentProcessor();
let after = values.after ?? null;
let scanned = 0,
	candidates = 0,
	inserted = 0,
	refreshed = 0,
	invalid = 0;
try {
	while (scanned < limit) {
		const rows = await sql`SELECT id,url,title,content,raw_json #>> '{}' AS raw FROM pages
			WHERE url LIKE 'https://developer.apple.com/%' AND url NOT LIKE 'https://developer.apple.com/videos/play/%'
				AND raw_json IS NOT NULL AND (${after}::uuid IS NULL OR id>${after}::uuid)
			ORDER BY id LIMIT ${Math.min(30, limit - scanned)}`;
		if (!rows.length) break;
		const chunks = await db.getChunkLayout(rows.map((r) => r.url));
		const ids = [],
			links = new Set();
		for (const row of rows) {
			let data;
			try {
				data = JSON.parse(row.raw);
			} catch {
				invalid++;
				continue;
			}
			const [result] = await processor.processDocuments([{ url: row.url, data }]);
			if (!result.data || (!result.data.content.trim() && row.content?.trim())) {
				invalid++;
				continue;
			}
			const { title, content, extractedUrls } = result.data;
			for (const u of extractedUrls) links.add(u);
			if (
				title !== row.title ||
				content !== row.content ||
				!matchesChunkLayout(
					chunkText(content, title),
					chunks.filter((c) => c.url === row.url),
				)
			)
				ids.push(row.id);
		}
		candidates += ids.length;
		if (values.apply) {
			if (ids.length) {
				assert.ok(process.env.DEEPINFRA_API_KEY, "Embedding credential required for repair");
				const collector = new AppleDocCollector(db, process.env.DEEPINFRA_API_KEY, {
					batchSize: ids.length,
					forceUpdateAll: false,
				});
				const result = await collector.execute(ids);
				assert.equal(
					result.updated + result.unchanged,
					ids.length,
					"Retry this batch from its previous cursor",
				);
				refreshed += result.updated;
			}
			inserted += await db.batchInsertUrls([...links]);
		}
		scanned += rows.length;
		after = rows.at(-1).id;
		console.log(
			JSON.stringify({
				apply: values.apply,
				scanned,
				candidates,
				invalid,
				inserted,
				refreshed,
				after,
			}),
		);
	}
} finally {
	await db.close();
	await sql.end({ timeout: 1 });
}
