import assert from "node:assert/strict";
import test from "node:test";
import { formatRAGResponse } from "./formatters/response-formatter.js";

test("includes the source URL for complete search results", () => {
	const output = formatRAGResponse(
		{
			success: true,
			query: "Swift",
			results: [
				{
					id: "1",
					url: "https://developer.apple.com/documentation/swift",
					title: "Swift",
					content: "Swift documentation",
					contentLength: 19,
					chunk_index: 0,
					total_chunks: 1,
				},
			],
			additionalUrls: [],
			degradations: [],
			count: 1,
			processing_time_ms: 1,
		},
		true,
	);

	assert.match(output, /Source: https:\/\/developer\.apple\.com\/documentation\/swift/);
});

test("merged search results are complete only when every chunk is present", () => {
	for (const indices of [
		[0, 1],
		[0, 0],
		[0, 2],
	]) {
		const output = formatRAGResponse(
			{
				success: true,
				query: "Swift",
				results: [
					{
						id: "1",
						url: "https://developer.apple.com/documentation/swift",
						title: "Swift",
						content: "Merged documentation",
						contentLength: 20,
						chunk_index: 0,
						total_chunks: 2,
						mergedChunkIndices: indices,
					},
				],
				additionalUrls: [],
				degradations: [],
				count: 1,
				processing_time_ms: 1,
			},
			true,
		);
		assert.equal(output.includes("Complete Document"), indices[1] === 1);
	}
});
