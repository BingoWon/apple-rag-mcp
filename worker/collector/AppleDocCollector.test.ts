import assert from "node:assert/strict";
import test from "node:test";
import { AppleAPIClient } from "./AppleAPIClient.js";
import { AppleDocCollector } from "./AppleDocCollector.js";
import { Chunker } from "./Chunker.js";
import { ContentProcessor } from "./ContentProcessor.js";
import type { PostgreSQLManager } from "./PostgreSQLManager.js";
import type { DatabaseRecord } from "./types/index.js";

test("failed URL sync leaves the source unchanged and a later collection retries discovery", async (t) => {
	const url = "https://developer.apple.com/documentation/collector-test/source";
	const child = "https://developer.apple.com/documentation/collector-test/child";
	const apiData = { metadata: { title: "New title" } };
	let stored: DatabaseRecord = {
		id: "source",
		url,
		title: "Old title",
		content: "",
		collect_count: 157,
		created_at: new Date(0),
		updated_at: null,
	};
	const events: string[] = [];
	let failSync = true;
	const cause = Object.assign(new Error("canceling statement due to lock timeout"), {
		code: "55P03",
	});
	const database = {
		getBatchRecords: async () => {
			events.push("claim");
			return [stored];
		},
		batchInsertUrls: async (urls: string[]) => {
			events.push("sync");
			assert.deepEqual(urls, [child]);
			if (failSync) throw cause;
			return 1;
		},
		batchUpdateFullRecords: async (
			records: Array<DatabaseRecord & { raw_json: string | null }>,
		) => {
			events.push("save");
			assert.deepEqual(JSON.parse(records[0].raw_json!), apiData);
			stored = records[0];
		},
	};
	t.mock.method(AppleAPIClient.prototype, "fetchDocuments", async () => [{ url, data: apiData }]);
	t.mock.method(ContentProcessor.prototype, "processDocuments", async () => [
		{ url, data: { title: "New title", content: "", extractedUrls: [child] } },
	]);
	t.mock.method(Chunker.prototype, "chunkTexts", () => []);
	const collector = new AppleDocCollector(database as unknown as PostgreSQLManager, "", {
		batchSize: 30,
		forceUpdateAll: false,
	});

	await assert.rejects(
		collector.execute(),
		(error: unknown) =>
			error instanceof Error &&
			error.message.includes("PostgreSQL discovered URL sync failed") &&
			error.cause === cause,
	);
	assert.equal(stored.title, "Old title");
	assert.deepEqual(events, ["claim", "sync"]);

	failSync = false;
	events.length = 0;
	assert.deepEqual(await collector.execute(), { totalChunks: 0 });
	assert.equal(stored.title, "New title");
	assert.deepEqual(events, ["claim", "sync", "save"]);

	events.length = 0;
	await collector.execute();
	assert.deepEqual(events, ["claim"]);
});

test("claim failures keep their cause and identify the database stage", async () => {
	const cause = Object.assign(new Error("canceling statement due to statement timeout"), {
		code: "57014",
	});
	const database = {
		getBatchRecords: async () => {
			throw cause;
		},
	};
	const collector = new AppleDocCollector(database as unknown as PostgreSQLManager, "", {
		batchSize: 30,
		forceUpdateAll: false,
	});
	await assert.rejects(
		collector.execute(),
		(error: unknown) =>
			error instanceof Error &&
			error.message.includes("PostgreSQL batch claim failed") &&
			error.cause === cause,
	);
});
