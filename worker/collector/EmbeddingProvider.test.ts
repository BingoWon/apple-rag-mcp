import assert from "node:assert/strict";
import test from "node:test";
import { createEmbeddings } from "./EmbeddingProvider.js";

test("embeds large inputs in bounded batches while preserving order", async () => {
	const originalFetch = globalThis.fetch;
	const batchSizes: number[] = [];

	globalThis.fetch = (async (_input, init) => {
		const body = JSON.parse(String(init?.body)) as { input: string[] };
		batchSizes.push(body.input.length);

		return Response.json({
			data: body.input
				.map((text, index) => ({
					index,
					embedding: Array.from({ length: 2560 }, (_, dimension) =>
						dimension === 0 ? Number(text) + 1 : 0,
					),
				}))
				.reverse(),
		});
	}) as typeof fetch;

	try {
		const input = Array.from({ length: 70 }, (_, index) => String(index));
		const output = await createEmbeddings(input, "test-key");

		assert.equal(output.length, input.length);
		assert.deepEqual(
			batchSizes.sort((a, b) => a - b),
			[6, 32, 32],
		);
		assert.ok(output.every((embedding) => embedding[0] === 1));
	} finally {
		globalThis.fetch = originalFetch;
	}
});
