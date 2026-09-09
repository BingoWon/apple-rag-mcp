import assert from "node:assert/strict";
import test from "node:test";
import { BatchEmbeddingProvider, createEmbeddings } from "./EmbeddingProvider.js";

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

test("retries an overloaded model and succeeds", async () => {
	const originalFetch = globalThis.fetch;
	let calls = 0;

	globalThis.fetch = (async (_input, init) => {
		calls++;
		const body = JSON.parse(String(init?.body)) as { input: string[] };
		if (calls < 3) {
			return new Response(
				JSON.stringify({
					error: {
						message: "Model busy, retry later",
						code: "engine_overloaded",
					},
				}),
				{ status: 429, headers: { "Retry-After": "0" } },
			);
		}

		return Response.json({
			data: body.input.map((_, index) => ({
				index,
				embedding: Array.from({ length: 2560 }, (_, dimension) => (dimension === 0 ? 1 : 0)),
			})),
		});
	}) as typeof fetch;

	try {
		const result = await new BatchEmbeddingProvider("test-key").encodeBatch(["retry me"]);
		assert.equal(calls, 3);
		assert.equal(result.length, 1);
	} finally {
		globalThis.fetch = originalFetch;
	}
});
