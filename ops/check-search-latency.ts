import assert from "node:assert/strict";
import tls from "node:tls";
import { DatabaseService } from "../worker/mcp-services/database.js";

const cases = [
	{
		name: "EDID / EDR / macOS",
		query:
			"EDID external display peak luminance EDR headroom macOS how maximum potential headroom is determined",
		relevant: /edr|dynamic.range|headroom|hdr|display/i,
	},
	{
		name: "AlarmKit / iOS",
		query: "AlarmKit availability iOS version requirements AlarmManager authorization",
		relevant: /alarmkit|alarmmanager/i,
	},
	{
		name: "Liquid Glass / iOS",
		query: "Liquid Glass effect API UIGlassEffect glassEffect iOS 27",
		relevant: /glass/i,
	},
	{
		name: "NSScreen / macOS",
		query:
			"NSScreen notification when EDR headroom changes maximumExtendedDynamicRangeColorComponentValue macOS brightness change",
		relevant: /screen|edr|headroom|dynamic.range/i,
	},
	{
		name: "Core Location / API / WWDC",
		query: "Core Location iOS 26 new API WWDC25 location updates",
		relevant: /corelocation/i,
	},
	{
		name: "Natural-language inspectors query",
		query: "Human Interface Guidelines inspectors macOS layout sections labels controls",
		relevant: /human-interface-guidelines\/(inspectors|layout|toolbars)/i,
	},
	{
		name: "ScreenCaptureKit / HDR",
		query:
			"ScreenCaptureKit HDR capture captureDynamicRange hdrLocalDisplay hdrCanonicalDisplay SCScreenshotManager preset captureHDRScreenshotLocalDisplay pixel format extended linear",
		relevant: /screencapturekit|screenshot|capturedynamicrange/i,
	},
	{
		name: "Contacts addContact",
		query: "CNSaveRequest addContact container identifier Contacts framework save request",
		relevant: /documentation\/contacts/i,
	},
	{
		name: "Contacts default container",
		query: "CNSaveRequest add contact toContainerWithIdentifier nil default container",
		relevant: /documentation\/contacts/i,
	},
] as const;

const required = (name: string) => {
	const value = process.env[name];
	assert.ok(value, `${name} is required`);
	return value;
};
const config = {
	RAG_DB_HOST: required("RAG_DB_HOST"),
	RAG_DB_PORT: Number(process.env.RAG_DB_PORT || 5432),
	RAG_DB_DATABASE: required("RAG_DB_DATABASE"),
	RAG_DB_USER: required("RAG_DB_USER"),
	RAG_DB_PASSWORD: required("RAG_DB_PASSWORD"),
	RAG_DB_SSLMODE: process.env.RAG_DB_SSLMODE || "require",
};
// postgres.js supplies a connected socket, so Node otherwise verifies "localhost".
// Retain CA verification and verify the certificate identity against the actual database host.
const checkServerIdentity = tls.checkServerIdentity;
tls.checkServerIdentity = (_host, certificate) =>
	checkServerIdentity(config.RAG_DB_HOST, certificate);
const maxMs = Number(process.env.SEARCH_BENCHMARK_MAX_MS || 3000);
assert.ok(Number.isFinite(maxMs) && maxMs > 0);
const samples = new Map<string, number[]>();
const failures: string[] = [];
const selectedCases = process.argv[2]
	? cases.filter((item) => item.name.toLowerCase().includes(process.argv[2].toLowerCase()))
	: cases;
assert.ok(selectedCases.length > 0, "No benchmark cases match the filter");

// Sequential, read-only calls through the real service; create a fresh client as production does.
for (let round = 1; round <= 3; round++) {
	for (const item of selectedCases) {
		const database = new DatabaseService(config);
		try {
			const startedAt = performance.now();
			const results = await database.keywordSearch(item.query, { resultCount: 16 });
			const elapsedMs = Math.round(performance.now() - startedAt);
			console.log(JSON.stringify({ round, name: item.name, elapsedMs, results: results.length }));
			if (!results.some((row) => item.relevant.test(`${row.url} ${row.title}`))) {
				failures.push(`${item.name}, round ${round}: relevant results missing`);
				console.log(JSON.stringify({ name: item.name, urls: results.map((row) => row.url) }));
			}
			if (elapsedMs >= maxMs)
				failures.push(`${item.name}, round ${round}: ${elapsedMs}ms exceeds ${maxMs}ms`);
			const timings = samples.get(item.name) ?? [];
			timings.push(elapsedMs);
			samples.set(item.name, timings);
		} catch (error) {
			failures.push(`${item.name}, round ${round}: ${String(error)}`);
		} finally {
			await database.close();
		}
	}
}

console.log(
	JSON.stringify(
		[...samples].map(([name, values]) => {
			const sorted = values.toSorted((a, b) => a - b);
			return { name, minMs: sorted[0], medianMs: sorted[1], maxMs: sorted[2] };
		}),
		null,
		2,
	),
);
assert.deepEqual(failures, [], "latency or relevance regressions");
