import assert from "node:assert/strict";
import test from "node:test";
import type { SearchResult } from "../mcp-types/index.js";
import { SearchEngine } from "./search-engine.js";

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
			rerank: async (_query: string, documents: string[], topN: number) =>
				documents.slice(0, topN).map((content, originalIndex) => ({
					content,
					originalIndex,
					relevanceScore: 1,
				})),
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

test("merges chunks only when they belong to the same URL", async () => {
	const url = "https://developer.apple.com/documentation/swift";
	const engine = createEngine({
		semantic: [result("a", url, "Swift", 0, 2), result("b", url, "Swift", 1, 2)],
	});

	const output = await engine.search("Swift", { resultCount: 1 });
	assert.deepEqual(output.results[0].mergedChunkIndices, [0, 1]);
	assert.equal(output.results[0].total_chunks, 1);
});

test("falls back when one retrieval mode fails", async () => {
	const engine = createEngine({
		semantic: new Error("embedding unavailable"),
		keyword: [result("a", "https://developer.apple.com/documentation/a", "A")],
	});

	const output = await engine.search("A", { resultCount: 1 });
	assert.equal(output.results.length, 1);
});

test("throws when both retrieval modes fail", async () => {
	const engine = createEngine({
		semantic: new Error("embedding unavailable"),
		keyword: new Error("database unavailable"),
	});

	await assert.rejects(() => engine.search("A"), /both failed/);
});
