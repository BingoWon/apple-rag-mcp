import assert from "node:assert/strict";
import test from "node:test";
import { EmbeddingService } from "./embedding.js";

test("uses fail-fast mode for real-time DeepInfra requests", async () => {
	const originalFetch = globalThis.fetch;
	let requestBody: Record<string, unknown> | undefined;

	globalThis.fetch = (async (_input, init) => {
		requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
		return Response.json({ data: [{ embedding: [3, 4] }] });
	}) as typeof fetch;

	try {
		const embedding = await new EmbeddingService("test-key").createEmbedding("test query");
		assert.deepEqual(embedding, [0.6, 0.8]);
		assert.equal(requestBody?.fail_fast, true);
	} finally {
		globalThis.fetch = originalFetch;
	}
});
