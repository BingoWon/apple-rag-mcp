import assert from "node:assert/strict";
import test from "node:test";
import type { EmbeddingService as IEmbeddingService } from "../mcp-types/index.js";
import {
	EmbeddingService,
	FallbackEmbeddingService,
	SiliconFlowEmbeddingService,
} from "./embedding.js";

const vector = [0.6, 0.8];

function provider(result: number[] | Error, calls?: { count: number }): IEmbeddingService {
	return {
		createEmbedding: async () => {
			if (calls) calls.count++;
			if (result instanceof Error) throw result;
			return result;
		},
	};
}

test("uses the primary provider when it succeeds", async () => {
	const fallbackCalls = { count: 0 };
	const service = new FallbackEmbeddingService(provider(vector), provider([1], fallbackCalls));
	assert.deepEqual(await service.createEmbedding("query"), vector);
	assert.equal(fallbackCalls.count, 0);
});

test("falls back to DeepInfra when the primary provider fails", async () => {
	const service = new FallbackEmbeddingService(
		provider(new Error("primary unavailable")),
		provider(vector),
	);
	assert.deepEqual(await service.createEmbedding("query"), vector);
});

test("throws the fallback error when both providers fail", async () => {
	const service = new FallbackEmbeddingService(
		provider(new Error("primary unavailable")),
		provider(new Error("fallback unavailable")),
	);
	await assert.rejects(() => service.createEmbedding("query"), /fallback unavailable/);
});

test("does not fall back after cancellation", async () => {
	const controller = new AbortController();
	const reason = new Error("User cancelled");
	controller.abort(reason);
	const fallbackCalls = { count: 0 };
	const service = new FallbackEmbeddingService(
		{
			createEmbedding: async (_text, signal) => {
				signal?.throwIfAborted();
				throw new Error("should not reach fallback");
			},
		},
		provider(vector, fallbackCalls),
	);
	await assert.rejects(() => service.createEmbedding("query", controller.signal), reason);
	assert.equal(fallbackCalls.count, 0);
});

test("SiliconFlow uses the OpenAI-compatible endpoint and 2560 dimensions", async (t) => {
	let requestUrl = "";
	let requestBody: Record<string, unknown> = {};
	let authorization = "";
	t.mock.method(globalThis, "fetch", async (input, init) => {
		requestUrl = String(input);
		requestBody = JSON.parse(String(init?.body));
		authorization = new Headers(init?.headers).get("authorization") ?? "";
		return Response.json({ data: [{ embedding: [1, 0] }] });
	});
	const service = new SiliconFlowEmbeddingService("sf-key", () => {});
	assert.deepEqual(await service.createEmbedding("query"), [1, 0]);
	assert.equal(requestUrl, "https://api.siliconflow.cn/v1/openai/embeddings");
	assert.equal(authorization, "Bearer sf-key");
	assert.equal(requestBody.model, "Qwen/Qwen3-Embedding-4B");
	assert.equal(requestBody.dimensions, 2560);
});

test("SiliconFlow failure falls back to DeepInfra with provider-specific alerts", async (t) => {
	const calls: string[] = [];
	const alerts: string[] = [];
	t.mock.method(globalThis, "fetch", async (input) => {
		const url = String(input);
		calls.push(url);
		if (url.startsWith("https://api.siliconflow.cn")) {
			return Response.json({ error: "insufficient balance" }, { status: 402 });
		}
		assert.equal(url, "https://api.deepinfra.com/v1/openai/embeddings");
		return Response.json({ data: [{ embedding: [0.6, 0.8] }] });
	});
	const service = new FallbackEmbeddingService(
		new SiliconFlowEmbeddingService("sf-key", (_key, message) => alerts.push(message)),
		new EmbeddingService("di-key", (_key, message) => alerts.push(message)),
	);
	assert.deepEqual(await service.createEmbedding("query"), [0.6, 0.8]);
	assert.equal(calls.length, 2);
	assert.equal(calls[0], "https://api.siliconflow.cn/v1/openai/embeddings");
	assert.match(alerts[0], /SiliconFlow Embedding generation failed/);
});
