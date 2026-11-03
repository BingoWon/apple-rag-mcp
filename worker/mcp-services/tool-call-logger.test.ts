import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { FetchTool } from "../mcp/tools/fetch-tool.js";
import { SearchTool } from "../mcp/tools/search-tool.js";
import type { Services } from "../mcp-types/index.js";
import { PageReadError } from "./page-reader.js";
import { ToolCallLogger } from "./tool-call-logger.js";

test("tools persist distinct results, provenance, zero-result searches and refunds through actual SQL", async (t) => {
	const sqlite = new DatabaseSync(":memory:");
	t.after(() => sqlite.close());
	const directory = new URL("../../migrations/", import.meta.url);
	for (const file of readdirSync(directory)
		.filter((name) => name.endsWith(".sql"))
		.sort())
		sqlite.exec(readFileSync(new URL(file, directory), "utf8"));
	const writes: Promise<unknown>[] = [];
	const db = {
		prepare: (sql: string) => ({
			bind: (...values: (string | number | null)[]) => ({
				run: async () => sqlite.prepare(sql).run(...values),
			}),
		}),
	};
	let refunds = 0;
	let search = { count: 0, degradations: [] as string[] };
	let fail = false;
	const services = {
		logger: new ToolCallLogger(db as unknown as D1Database, {
			waitUntil: (write) => writes.push(write),
		}),
		rateLimit: {
			checkLimits: async () => ({
				allowed: true,
				planType: "hobby",
				limitType: "weekly",
				limit: 50,
				remaining: 49,
				resetAt: "2026-11-08T00:00:00Z",
				minuteLimit: 5,
				minuteRemaining: 4,
				minuteResetAt: "2026-11-03T06:00:00Z",
			}),
			refund: async () => {
				refunds++;
			},
		},
		rag: {
			query: async () => ({
				success: true,
				query: "Swift",
				results: [],
				additionalUrls: [],
				...search,
			}),
		},
		pages: {
			getPage: async () => {
				if (fail)
					throw new PageReadError(
						"PAGE_NOT_FOUND",
						"Missing",
						404,
						"no_content",
						"https://docs.example.com/missing",
						"firecrawl",
						404,
						true,
					);
				return {
					url: "https://docs.example.com/Page",
					title: "Page",
					content: "Readable text",
					source: "third_party",
					provider: "firecrawl",
					status: 200,
					pageId: null,
					cacheHit: true,
				};
			},
		},
	} as unknown as Services;
	const auth = { isAuthenticated: true, userId: "reader" };
	const request = new Request("https://mcp.apple-rag.com");
	await new SearchTool(services).handle({ query: "Swift", result_count: 1 }, auth, request);
	search = { count: 1, degradations: ["EMBEDDING_FALLBACK", "RERANKER_FALLBACK"] };
	await new SearchTool(services).handle({ query: "Swift", result_count: 1 }, auth, request);
	const response = await new FetchTool(services).handle(
		{ url: "https://docs.example.com/Page" },
		auth,
		request,
	);
	assert.match(JSON.stringify(response), /Third-party website/);
	fail = true;
	assert.equal(
		(
			await new FetchTool(services).handle(
				{ url: "https://docs.example.com/missing" },
				auth,
				request,
			)
		).isError,
		true,
	);
	await Promise.all(writes);
	assert.equal(refunds, 1);
	assert.deepEqual(
		sqlite
			.prepare("SELECT outcome,error_code FROM search_logs ORDER BY rowid")
			.all()
			.map((row) => ({ ...row })),
		[
			{ outcome: "no_content", error_code: null },
			{ outcome: "degraded", error_code: "EMBEDDING_FALLBACK,RERANKER_FALLBACK" },
		],
	);
	assert.deepEqual(
		sqlite
			.prepare(
				"SELECT outcome,provider,content_source,cache_hit,upstream_status FROM fetch_logs ORDER BY rowid",
			)
			.all()
			.map((row) => ({ ...row })),
		[
			{
				outcome: "degraded",
				provider: "firecrawl",
				content_source: "third_party",
				cache_hit: 1,
				upstream_status: 200,
			},
			{
				outcome: "no_content",
				provider: "firecrawl",
				content_source: "third_party",
				cache_hit: 1,
				upstream_status: 404,
			},
		],
	);
});

test("outcome migration preserves historical log rows and indexes and permits cancellation", () => {
	const sqlite = new DatabaseSync(":memory:");
	try {
		const dir = new URL("../../migrations/", import.meta.url);
		for (const file of readdirSync(dir)
			.filter((f) => f.endsWith(".sql") && !f.startsWith("0007"))
			.sort())
			sqlite.exec(readFileSync(new URL(file, dir), "utf8"));
		sqlite.exec(
			"INSERT INTO search_logs (user_id,requested_query,actual_query,outcome) VALUES ('reader','Swift','Swift','success'); INSERT INTO fetch_logs (user_id,requested_url,actual_url,outcome,content_source,provider,upstream_status,cache_hit) VALUES ('reader','old','canonical','degraded','apple','apple_json',200,1)",
		);
		const rows = [
			sqlite.prepare("SELECT * FROM search_logs").all(),
			sqlite.prepare("SELECT * FROM fetch_logs").all(),
		];
		const indexes = sqlite
			.prepare(
				"SELECT name,sql FROM sqlite_master WHERE type='index' AND tbl_name IN ('search_logs','fetch_logs') ORDER BY name",
			)
			.all();
		sqlite.exec(readFileSync(new URL("0007_cancelled_tool_outcomes.sql", dir), "utf8"));
		assert.deepEqual(
			[
				sqlite.prepare("SELECT * FROM search_logs").all(),
				sqlite.prepare("SELECT * FROM fetch_logs").all(),
			],
			rows,
		);
		assert.deepEqual(
			sqlite
				.prepare(
					"SELECT name,sql FROM sqlite_master WHERE type='index' AND tbl_name IN ('search_logs','fetch_logs') ORDER BY name",
				)
				.all(),
			indexes,
		);
		sqlite.exec(
			"UPDATE search_logs SET outcome='cancelled',status_code=499,error_code='REQUEST_CANCELLED'; UPDATE fetch_logs SET outcome='cancelled',status_code=499,error_code='REQUEST_CANCELLED'",
		);
		assert.throws(() => sqlite.exec("UPDATE search_logs SET outcome='anything'"), /CHECK/);
	} finally {
		sqlite.close();
	}
});
