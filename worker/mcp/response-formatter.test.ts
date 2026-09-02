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
			count: 1,
			processing_time_ms: 1,
		},
		true,
	);

	assert.match(output, /Source: https:\/\/developer\.apple\.com\/documentation\/swift/);
});
