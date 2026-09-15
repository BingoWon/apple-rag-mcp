import assert from "node:assert/strict";
import test from "node:test";
import { EmbeddingService } from "./embedding.js";
import { RerankerService } from "./reranker.js";

function waitForCancellation(signal: AbortSignal): Promise<Response> {
	return new Promise((_, reject) => {
		signal.throwIfAborted();
		const timer = setTimeout(() => reject(new Error("request was not canceled")), 10_000);
		signal.addEventListener(
			"abort",
			() => {
				clearTimeout(timer);
				reject(signal.reason);
			},
			{ once: true },
		);
	});
}

test("a stalled primary reranker is canceled before switching to the fallback model", async () => {
	const originalFetch = globalThis.fetch;
	const requests: string[] = [];
	let primarySignal: AbortSignal | undefined;
	globalThis.fetch = (async (input, init) => {
		requests.push(String(input));
		if (requests.length === 1) {
			primarySignal = init!.signal!;
			return waitForCancellation(primarySignal);
		}
		return Response.json({ scores: [0.1, 0.9] });
	}) as typeof fetch;
	try {
		const startedAt = Date.now();
		const result = await new RerankerService("test-key").rerank("query", ["first", "second"], 1);
		assert.equal(result[0].originalIndex, 1);
		assert.equal(primarySignal?.aborted, true);
		assert.equal(requests.length, 2);
		assert.match(requests[0], /Reranker-8B$/);
		assert.match(requests[1], /Reranker-4B$/);
		assert.ok(
			Date.now() - startedAt < 3500,
			"must not wait five seconds before trying the fallback",
		);
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test("embedding retries share one deadline instead of restarting the timeout", async () => {
	const originalFetch = globalThis.fetch;
	const signals: AbortSignal[] = [];
	globalThis.fetch = (async (_input, init) => {
		signals.push(init!.signal!);
		if (signals.length === 1) {
			await new Promise((resolve) => setTimeout(resolve, 3000));
			return new Response("model busy", { status: 503 });
		}
		return waitForCancellation(init!.signal!);
	}) as typeof fetch;
	try {
		const startedAt = Date.now();
		await assert.rejects(new EmbeddingService("test-key").createEmbedding("query"), {
			name: "TimeoutError",
		});
		assert.equal(signals.length, 2);
		assert.equal(signals[0], signals[1]);
		assert.equal(signals[1].aborted, true);
		assert.ok(Date.now() - startedAt < 6500, "retry must use the remaining time budget");
	} finally {
		globalThis.fetch = originalFetch;
	}
});
