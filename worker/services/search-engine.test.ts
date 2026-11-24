import assert from "node:assert/strict";
import test from "node:test";
import { formatRAGResponse } from "../mcp/formatters/response-formatter.js";
import type { SearchResult } from "../services/types.js";
import { SearchEngine } from "./search-engine.js";
import { searchOutput } from "./tool-results.js";

const result = (
	id: string,
	url: string,
	title: string,
	chunk_index = 0,
	total_chunks = 1,
): SearchResult => ({
	id,
	url,
	title,
	content: `content-${id}`,
	contentLength: 9,
	chunk_index,
	total_chunks,
});

function createEngine(options?: {
	semantic?: SearchResult[] | Error;
	keyword?: SearchResult[] | Error;
	rerankError?: Error;
}) {
	const semantic = options?.semantic ?? [];
	const keyword = options?.keyword ?? [];

	return new SearchEngine(
		{
			semanticSearch: async () => {
				if (semantic instanceof Error) throw semantic;
				return semantic;
			},
			keywordSearch: async () => {
				if (keyword instanceof Error) throw keyword;
				return keyword;
			},
		} as never,
		{ createEmbedding: async () => [1] } as never,
		{
			rerank: async (_query: string, documents: Array<{ content: string }>, topN: number) => {
				if (options?.rerankError) throw options.rerankError;
				return documents.slice(0, topN).map((document, originalIndex) => ({
					content: document.content,
					originalIndex,
					relevanceScore: 1,
				}));
			},
		} as never,
	);
}

test("keeps identical titles from different URLs separate", async () => {
	const engine = createEngine({
		semantic: [
			result("a", "https://developer.apple.com/documentation/a", "Initializer: init()"),
			result("b", "https://developer.apple.com/documentation/b", "Initializer: init()"),
		],
	});

	const output = await engine.search("initializer", { resultCount: 2 });
	assert.deepEqual(
		output.results.map((item) => item.url),
		["https://developer.apple.com/documentation/a", "https://developer.apple.com/documentation/b"],
	);
});

test("merges chunks only when they belong to the same URL and preserves completeness end-to-end", async () => {
	const url = "https://developer.apple.com/documentation/swift";
	const engine = createEngine({
		semantic: [result("a", url, "Swift", 0, 2), result("b", url, "Swift", 1, 2)],
	});

	const output = await engine.search("Swift", { resultCount: 1 });
	assert.deepEqual(output.results[0].mergedChunkIndices, [0, 1]);
	assert.equal(output.results[0].total_chunks, 2);

	const structured = searchOutput(
		{
			success: true,
			query: "Swift",
			results: output.results.map((item) => ({ ...item, contentLength: item.content.length })),
			additionalUrls: [],
			degradations: [],
			count: output.results.length,
			processing_time_ms: 1,
		},
		{
			authenticated: true,
			auth_method: "token",
			email: "dev@example.com",
			plan: "pro",
			quota: {
				week: { limit: 50000, remaining: 49999, reset_at: "2026-12-01T00:00:00.000Z" },
				minute: { limit: 50, remaining: 49, reset_at: "2026-11-24T00:01:00.000Z" },
			},
			login_url: "https://apple-rag.com/mcp-tokens",
			upgrade_url: "https://apple-rag.com/#pricing",
		},
	);
	assert.equal(structured.ok, true);
	assert.equal(structured.results[0].complete, true);
	const formatted = formatRAGResponse(structured, true);
	assert.match(formatted, /✅ Complete Document/);
	assert.doesNotMatch(formatted, /Parts 1, 2 merged \(1 total\)/);
	assert.doesNotMatch(formatted, /use Apple RAG MCP fetch tool/);
});

test("falls back when one retrieval mode fails", async () => {
	const engine = createEngine({
		semantic: new Error("embedding unavailable"),
		keyword: [result("a", "https://developer.apple.com/documentation/a", "A")],
	});

	const output = await engine.search("A", { resultCount: 1 });
	assert.equal(output.results.length, 1);
	assert.deepEqual(output.degradations, ["SEMANTIC_UNAVAILABLE"]);
});

test("throws when both retrieval modes fail", async () => {
	const engine = createEngine({
		semantic: new Error("embedding unavailable"),
		keyword: new Error("database unavailable"),
	});

	await assert.rejects(() => engine.search("A"), /both failed/);
});

test("keeps original candidate order and full content when both rerankers fail", async () => {
	const engine = createEngine({
		semantic: [result("a", "https://developer.apple.com/a", "A")],
		keyword: [result("b", "https://developer.apple.com/b", "B")],
		rerankError: new Error("Both rerankers failed"),
	});
	const output = await engine.search("query", { resultCount: 2 });
	assert.deepEqual(output.degradations, ["RERANKING_UNAVAILABLE"]);
	assert.deepEqual(
		output.results.map((row) => row.id),
		["a", "b"],
	);
	assert.deepEqual(
		output.results.map((row) => row.content),
		["content-a", "content-b"],
	);
});

test("cancelled reranking propagates cancellation instead of returning original candidates", async () => {
	const controller = new AbortController();
	const reason = new Error("User cancelled");
	const engine = new SearchEngine(
		{
			semanticSearch: async () => [result("a", "https://developer.apple.com/a", "A")],
			keywordSearch: async () => [],
		} as never,
		{ createEmbedding: async () => [1] } as never,
		{
			rerank: async (_query: string, _documents: unknown, _topN: number, signal: AbortSignal) => {
				assert.equal(signal, controller.signal);
				controller.abort(reason);
				throw reason;
			},
		} as never,
	);
	await assert.rejects(engine.search("query", { signal: controller.signal }), reason);
});
