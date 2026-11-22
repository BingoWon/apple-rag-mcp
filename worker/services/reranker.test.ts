import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import type { ModelUsageEvent } from "./model-usage.js";
import { searchTrace } from "./request-info.js";
import { type RerankDocument, RerankerService } from "./reranker.js";

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
	await assert.rejects(
		() => setup.reranker.rerank("query", documents, 1),
		/original candidate order/,
	);
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
	assert.match(setup.alerts[0], /original candidate order/);
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

test("CN searches use Qwen at any ingress and all other countries try Jev first", async (t) => {
	const setup = service(t, (url, body) =>
		url.includes("deepinfra")
			? Response.json({ scores: [0.2, 0.9] })
			: jevResponse(body as { questions: Record<string, unknown> }),
	);
	for (const [country, ingress, model] of [
		["CN", "AMS", "reranking"],
		["CN", "DFW", "reranking"],
		["CN", undefined, "reranking"],
		["US", "AMS", "jev"],
		["HK", "AMS", "jev"],
		["XX", "AMS", "jev"],
		[undefined, undefined, "jev"],
	] as const) {
		const request = Object.assign(new Request("https://mcp.apple-rag.com/"), {
			cf: { country, colo: ingress },
		});
		const usage: ModelUsageEvent[] = [];
		const reasons: string[] = [];
		const before = setup.calls.length;
		const r = new RerankerService(
			{ ...keys, ZENMUX_API_KEY: "test-zenmux" },
			(_key, msg) => setup.alerts.push(msg),
			(e) => usage.push(e),
			searchTrace(request, "test").country,
		);
		const ranked = await r.rerank("SwiftUI", documents, 1, undefined, (reason) =>
			reasons.push(reason),
		);
		assert.equal(ranked[0].originalIndex, 1);
		assert.equal(setup.calls.length - before, 1);
		assert.deepEqual(
			usage.map((e) => e.category),
			[model],
		);
		assert.deepEqual(reasons, model === "jev" ? [] : ["RERANKER_FALLBACK"]);
	}
	assert.deepEqual(setup.alerts, []);
});

test("an explicit region denial selects Qwen immediately; a different 451 still offers ZenMux", async (t) => {
	let title = "Typesafe is not available in your region.";
	const setup = service(t, (url) => {
		if (url.includes("typesafe.ai")) return Response.json({ title }, { status: 451 });
		if (url.includes("zenmux")) return new Response("unavailable", { status: 503 });
		return Response.json({ scores: [0, 1] });
	});
	const r = new RerankerService({ ...keys, ZENMUX_API_KEY: "test-zenmux" }, (_key, msg) =>
		setup.alerts.push(msg),
	);
	await r.rerank("SwiftUI", documents, 1);
	assert.deepEqual(
		setup.calls.map((u) => new URL(u).hostname),
		["api.typesafe.ai", "api.deepinfra.com"],
	);
	title = "Different restriction";
	await r.rerank("SwiftUI", documents, 1);
	assert.deepEqual(
		setup.calls.slice(2).map((u) => new URL(u).hostname),
		["api.typesafe.ai", "zenmux.ai", "api.deepinfra.com"],
	);
});

test("a failed regional Qwen request reports only the provider actually called", async (t) => {
	const setup = service(t, () => new Response("outage", { status: 503 }));
	const r = new RerankerService(keys, (_key, msg) => setup.alerts.push(msg), undefined, "CN");
	await assert.rejects(r.rerank("SwiftUI", documents, 1), /original candidate order/);
	assert.equal(setup.calls.length, 1);
	assert.match(setup.alerts[0], /Jev skipped[\s\S]*Qwen3-Reranker-8B failed: HTTP 503/);
});
