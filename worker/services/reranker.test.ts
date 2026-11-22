import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { EmbeddingService } from "./embedding.js";
import type { ModelUsageEvent } from "./model-usage.js";
import { type RerankDocument, RerankerService } from "./reranker.js";
import { TypeSafeRegion } from "./typesafe-region.js";

const documents: RerankDocument[] = [
	{ title: "Unrelated", url: "https://developer.apple.com/a", content: "A document" },
	{ title: "NavigationStack", url: "https://developer.apple.com/b", content: "B document" },
];
const keys = { TYPESAFE_API_KEY: "private-jev-key", DEEPINFRA_API_KEY: "private-deepinfra-key" };

function jevResponse(body: { questions: Record<string, unknown> }) {
	return Response.json({
		model: "jev-1.13.0",
		answers: Object.fromEntries(
			Object.keys(body.questions).map((id, index) => [
				id,
				{ type: "score", score: index ? 2.9 : 0.2 },
			]),
		),
	});
}

function service(
	t: TestContext,
	handler: (
		url: string,
		body: Record<string, unknown>,
		init?: RequestInit,
	) => Response | Promise<Response>,
) {
	const calls: string[] = [];
	const alerts: string[] = [];
	t.mock.method(globalThis, "fetch", async (input, init) => {
		const url = String(input);
		calls.push(url);
		return handler(url, JSON.parse(String(init?.body)), init);
	});
	return {
		reranker: new RerankerService(keys, (_key, message) => alerts.push(message)),
		calls,
		alerts,
	};
}

test("ZenMux Jev recovers before Qwen and records both Jev attempts under one category", async (t) => {
	const zenmuxKey = "private-zenmux-test-key";
	const setup = service(t, (url, body, init) => {
		if (url === "https://api.typesafe.ai/v1/systemone") {
			return Response.json({ error: "unavailable" }, { status: 503 });
		}
		assert.equal(url, "https://zenmux.ai/api/v1/systemone");
		assert.equal(new Headers(init?.headers).get("authorization"), `Bearer ${zenmuxKey}`);
		assert.equal(body.model, "typesafe/jev-1.14");
		assert.deepEqual(Object.keys(body.questions as object), ["d0", "d1"]);
		return Response.json({
			model: body.model,
			answers: { d0: { type: "score", score: 0 }, d1: { type: "score", score: 2.93 } },
			usage: { input_tokens: 459 },
		});
	});
	const usage: ModelUsageEvent[] = [];
	const reranker = new RerankerService(
		{ ...keys, ZENMUX_API_KEY: zenmuxKey },
		(_key, message) => setup.alerts.push(message),
		(event) => usage.push(event),
	);
	const ranked = await reranker.rerank("NavigationStack", documents, 1);
	assert.equal(ranked[0].originalIndex, 1);
	assert.equal(setup.calls.length, 2);
	assert.deepEqual(usage, [
		{ category: "jev" },
		{
			category: "jev",
			inputTokens: 459,
			currency: "USD",
			costNanos: 19278,
			costSource: "estimated",
		},
	]);
});

test("unusable ZenMux scores go to Qwen and keep both providers' metered costs", async (t) => {
	const setup = service(t, (url) => {
		if (url.includes("api.typesafe.ai")) return new Response("unavailable", { status: 503 });
		if (url.includes("zenmux.ai")) {
			return Response.json({
				model: "typesafe/jev-1.14",
				answers: { d0: { type: "score", score: 0 } },
				usage: { input_tokens: 200 },
			});
		}
		return Response.json({
			scores: [0.3, 0.9],
			input_tokens: 100,
			inference_status: { cost: 0.000006 },
		});
	});
	const usage: ModelUsageEvent[] = [];
	const reranker = new RerankerService(
		{ ...keys, ZENMUX_API_KEY: "private-zenmux-test-key" },
		(_key, message) => setup.alerts.push(message),
		(event) => usage.push(event),
	);
	assert.equal((await reranker.rerank("NavigationStack", documents, 1))[0].originalIndex, 1);
	assert.deepEqual(
		setup.calls.map((url) => new URL(url).hostname),
		["api.typesafe.ai", "zenmux.ai", "api.deepinfra.com"],
	);
	assert.deepEqual(
		usage.map(({ category, costNanos }) => [category, costNanos]),
		[
			["jev", undefined],
			["jev", 8400],
			["reranking", 6000],
		],
	);
});

for (const cancelBackup of [false, true]) {
	test(`cancelling ${cancelBackup ? "backup" : "Jev"} aborts the request without fallback or alerts`, async (t) => {
		const controller = new AbortController();
		const reason = new Error("User cancelled");
		const setup = service(t, (url, _body, init) => {
			if (cancelBackup && url.includes("typesafe"))
				return new Response("unavailable", { status: 503 });
			return new Promise<Response>((_resolve, reject) => {
				const signal = init?.signal;
				assert.ok(signal);
				signal.addEventListener("abort", () => reject(signal.reason), { once: true });
				controller.abort(reason);
				assert.equal(signal.aborted, true);
			});
		});
		await assert.rejects(setup.reranker.rerank("query", documents, 1, controller.signal), reason);
		assert.equal(setup.calls.length, cancelBackup ? 2 : 1);
		assert.deepEqual(setup.alerts, []);
	});
}

test("cancelled embeddings do not retry or send provider failure alerts", async (t) => {
	const controller = new AbortController();
	const reason = new Error("User cancelled");
	let calls = 0;
	const alerts: string[] = [];
	t.mock.method(globalThis, "fetch", async (_input, init) => {
		calls++;
		const signal = init?.signal;
		assert.ok(signal);
		controller.abort(reason);
		assert.equal(signal.aborted, true);
		throw signal.reason;
	});
	const embedding = new EmbeddingService(keys, (_key, message) => alerts.push(message));
	await assert.rejects(embedding.createEmbedding("query", controller.signal), reason);
	assert.equal(calls, 1);
	assert.deepEqual(alerts, []);
});

test("uses Jev score-only requests with metadata and preserves original document mapping", async (t) => {
	const setup = service(t, (url, body, init) => {
		assert.equal(url, "https://api.typesafe.ai/v1/systemone");
		assert.equal(
			new Headers(init?.headers).get("authorization"),
			`Bearer ${keys.TYPESAFE_API_KEY}`,
		);
		assert.equal(body.model, "jev-latest");
		const state = body.state as { documents: RerankDocument[] };
		assert.equal(state.documents[1].title, "NavigationStack");
		assert.equal(state.documents[1].url, documents[1].url);
		const request = body as { questions: Record<string, { type: string }> };
		assert.ok(Object.values(request.questions).every((question) => question.type === "score"));
		return jevResponse(request);
	});
	const result = await setup.reranker.rerank("SwiftUI navigation", documents, 1);
	assert.equal(result[0].originalIndex, 1);
	assert.equal(result[0].content, "B document");
	assert.equal(setup.calls.length, 1);
	assert.equal(setup.alerts.length, 0);
});

for (const status of [401, 402, 403, 429, 500, 503]) {
	test(`Jev HTTP ${status} immediately falls back to 8B and reports recovery`, async (t) => {
		const setup = service(t, (url, _body, init) => {
			if (url.includes("typesafe")) {
				return Response.json({ error: `provider failure ${keys.TYPESAFE_API_KEY}` }, { status });
			}
			assert.ok(url.endsWith("Qwen/Qwen3-Reranker-8B"));
			assert.equal(
				new Headers(init?.headers).get("authorization"),
				`Bearer ${keys.DEEPINFRA_API_KEY}`,
			);
			return Response.json({ scores: [0.1, 0.9] });
		});
		const reasons: string[] = [];
		const result = await setup.reranker.rerank("query", documents, 1, undefined, (reason) =>
			reasons.push(reason),
		);
		assert.deepEqual(reasons, ["RERANKER_FALLBACK"]);
		assert.equal(result[0].originalIndex, 1);
		assert.equal(setup.calls.length, 2);
		assert.equal(setup.alerts.length, 1);
		assert.match(setup.alerts[0], new RegExp(`HTTP ${status}`));
		assert.match(setup.alerts[0], /Fallback Qwen3-Reranker-8B succeeded/);
		assert.ok(!setup.alerts[0].includes(keys.TYPESAFE_API_KEY));
	});
}

test("timeout switches provider without retrying Jev", async (t) => {
	const setup = service(t, (url) => {
		if (url.includes("typesafe")) {
			const error = new Error("request timed out");
			error.name = "TimeoutError";
			throw error;
		}
		return Response.json({ scores: [0.1, 0.9] });
	});
	await setup.reranker.rerank("query", documents, 1);
	assert.equal(setup.calls.length, 2);
	assert.match(setup.alerts[0], /timed out/);
});

test("missing Jev key does not prevent the configured backup from working", async (t) => {
	const setup = service(t, () => Response.json({ scores: [0.9, 0.1] }));
	const reranker = new RerankerService(
		{ DEEPINFRA_API_KEY: keys.DEEPINFRA_API_KEY },
		(_key, message) => setup.alerts.push(message),
	);
	await reranker.rerank("query", documents, 1);
	assert.equal(setup.calls.length, 1);
	assert.match(setup.alerts[0], /TYPESAFE_API_KEY is not configured/);
});

test("invalid or missing Jev scores use a whole-batch fallback, not mixed scores", async (t) => {
	const setup = service(t, (url) =>
		url.includes("typesafe")
			? Response.json({ model: "jev-1.13.0", answers: { d0: { type: "score", score: "2.9" } } })
			: Response.json({ scores: [0.8, 0.2] }),
	);
	const result = await setup.reranker.rerank("query", documents, 2);
	assert.deepEqual(
		result.map((row) => row.relevanceScore),
		[0.8, 0.2],
	);
	assert.equal(setup.alerts.length, 1);
});

test("both failures report both reasons and throw for original-order recovery", async (t) => {
	const setup = service(t, (url) =>
		Response.json(
			{ error: url.includes("typesafe") ? "insufficient credits" : keys.DEEPINFRA_API_KEY },
			{ status: url.includes("typesafe") ? 402 : 403 },
		),
	);
	await assert.rejects(() => setup.reranker.rerank("query", documents, 1), /Both rerankers failed/);
	assert.equal(setup.calls.length, 2);
	assert.equal(setup.alerts.length, 1);
	assert.match(setup.alerts[0], /insufficient credits/);
	assert.match(setup.alerts[0], /HTTP 403/);
	assert.ok(!setup.alerts[0].includes(keys.DEEPINFRA_API_KEY));
});

test("invalid backup scores are treated as failure rather than silently padded", async (t) => {
	const setup = service(t, (url) =>
		url.includes("typesafe")
			? Response.json({ error: "unavailable" }, { status: 503 })
			: Response.json({ scores: [0.9] }),
	);
	await assert.rejects(() => setup.reranker.rerank("query", documents, 1), /Incomplete or invalid/);
	assert.match(setup.alerts[0], /Both rerankers failed/);
});

test("bounds large UTF-8 contexts without dropping candidates or truncating returned text", async (t) => {
	const large = Array.from({ length: 80 }, (_, index) => ({
		title: `Document ${index}`,
		url: `https://developer.apple.com/doc/${index}`,
		content: `Header ${index}\n${"SwiftUI navigation path ".repeat(2000)}`,
	}));
	const setup = service(t, (_url, body) => {
		const state = body.state as { documents: unknown[] };
		assert.equal(state.documents.length, 80);
		assert.ok(new TextEncoder().encode(JSON.stringify(state)).length <= 64_000);
		return jevResponse(body as { questions: Record<string, unknown> });
	});
	const result = await setup.reranker.rerank("SwiftUI navigation path", large, 4);
	assert.ok(result.every((row) => row.content === large[row.originalIndex].content));
	assert.equal(setup.alerts.length, 0);
});

test("DeepInfra embedding failures use the same alert callback", async (t) => {
	const alerts: string[] = [];
	let calls = 0;
	t.mock.method(globalThis, "fetch", async () => {
		calls++;
		return Response.json({ error: "insufficient balance" }, { status: 402 });
	});
	const embedding = new EmbeddingService(keys, (_key, message) => alerts.push(message));
	await assert.rejects(() => embedding.createEmbedding("query"), /HTTP 402/);
	assert.equal(calls, 1);
	assert.match(alerts[0], /Embedding generation failed/);
});

test("regional 451s pause only TypeSafe on the affected path, and recovery uses a real search", async (t) => {
	let now = Date.now();
	t.mock.method(Date, "now", () => now);
	const entries = new Map<string, { value: string; expires: number }>();
	const cache = {
		async match(key: string) {
			const entry = entries.get(key);
			if (entry && entry.expires > now) return new Response(entry.value);
		},
		async put(key: string, response: Response) {
			const seconds = Number(response.headers.get("cache-control")?.split("max-age=")[1]);
			entries.set(key, { value: await response.text(), expires: now + seconds * 1000 });
		},
		async delete(key: string) {
			return entries.delete(key);
		},
	} as Cache;
	let primary: "region" | "legal" | "good" = "region";
	const setup = service(t, (url, body) => {
		if (url.includes("typesafe.ai")) {
			if (primary === "good") return jevResponse(body as { questions: Record<string, unknown> });
			return Response.json(
				{
					title:
						primary === "region"
							? "Typesafe is not available in your region."
							: "Other legal restriction",
				},
				{ status: 451 },
			);
		}
		if (url.includes("zenmux"))
			return Response.json(
				{ error: { code: "invalid_params", message: "systemone failed (request_id: zm-example)" } },
				{ status: 400 },
			);
		return Response.json({ scores: [0, 1] }, { headers: { "x-request-id": "qwen-example" } });
	});
	const env = { ...keys, ZENMUX_API_KEY: "test-zenmux" };
	const run = async (path = "AMS/CN") => {
		const usage: ModelUsageEvent[] = [];
		const count = setup.calls.length;
		const reranker = new RerankerService(
			env,
			(_key, msg) => setup.alerts.push(msg),
			(e) => usage.push(e),
			new TypeSafeRegion(cache, path),
		);
		const ranked = await reranker.rerank("SwiftUI", documents, 1);
		assert.equal(ranked[0].originalIndex, 1);
		assert.equal(usage.length, setup.calls.length - count);
		return setup.calls.slice(count).map((url) => new URL(url).hostname);
	};
	const all = ["api.typesafe.ai", "zenmux.ai", "api.deepinfra.com"];
	assert.deepEqual(await run(), all);
	primary = "legal";
	assert.deepEqual(await run(), all);
	primary = "region";
	assert.deepEqual(await run(), all);
	now += 601_000; // An isolated old denial does not count.
	assert.deepEqual(await run(), all);
	assert.deepEqual(await run(), all);
	assert.deepEqual(await run(), all.slice(1));
	assert.match(
		setup.alerts.at(-1)!,
		/skipped.*451[\s\S]*zm-example[\s\S]*upstream_request_id=qwen-example/,
	);
	assert.deepEqual(await run("DFW/US"), all);
	assert.deepEqual(await run("AMS/NL"), all);
	now += 300_000;
	assert.deepEqual(await run(), all); // Failed recovery probe renews the pause.
	assert.deepEqual(await run(), all.slice(1));
	now += 300_000;
	primary = "good";
	assert.deepEqual(await run(), [all[0]]);
	primary = "region";
	assert.deepEqual(await run(), all);
	assert.deepEqual(await run(), all);
});

test("a recovery probe is released on cancellation and cache failures allow normal traffic", async (t) => {
	const cache = { match: async () => new Response(String(Date.now() - 1)) } as Cache;
	const probe = new TypeSafeRegion(cache, "probe-path");
	const next = () => new TypeSafeRegion(cache, "probe-path");
	const controller = new AbortController();
	service(t, (_url, _body, init) => {
		controller.abort();
		init!.signal!.throwIfAborted();
		return new Response();
	});
	assert.equal(await probe.skip(), false);
	assert.equal(await next().skip(), true);
	await probe.finish();
	const key = "cancelled-path";
	const cancelled = new RerankerService(
		keys,
		() => assert.fail("cancelled"),
		undefined,
		new TypeSafeRegion(cache, key),
	);
	await assert.rejects(cancelled.rerank("query", documents, 1, controller.signal), {
		name: "AbortError",
	});
	const retry = new TypeSafeRegion(cache, key);
	assert.equal(await retry.skip(), false);
	await retry.finish();
	const broken = new TypeSafeRegion(
		{
			match: async () => {
				throw Error("cache offline");
			},
		} as Cache,
		key,
	);
	assert.equal(await broken.skip(), false);
	await broken.finish(true);
});
