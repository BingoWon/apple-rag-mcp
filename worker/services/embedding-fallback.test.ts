import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { EmbeddingService } from "./embedding.js";
import type { ModelUsageEvent } from "./model-usage.js";

const keys = { SILICONFLOW_API_KEY: "sf-key", DEEPINFRA_API_KEY: "di-key" };
const vector = [3, 4, ...Array(2558).fill(0)];
const success = () => Response.json({ data: [{ embedding: vector }], usage: { prompt_tokens: 5 } });
const unavailable = () => new Response(null, { status: 503 });

function harness(
	t: TestContext,
	reply: (index: number, init: RequestInit) => Response | Promise<Response>,
	env = keys,
) {
	const calls: string[] = [];
	const timers: { ms: number; controller: AbortController }[] = [];
	const alerts: string[] = [];
	const reasons: string[] = [];
	const usage: ModelUsageEvent[] = [];
	t.mock.method(AbortSignal, "timeout", (ms: number) => {
		const controller = new AbortController();
		timers.push({ ms, controller });
		return controller.signal;
	});
	t.mock.method(globalThis, "fetch", async (url, init: RequestInit) => {
		const sf = new URL(String(url)).hostname === "api.siliconflow.cn";
		assert.equal(
			String(url),
			sf
				? "https://api.siliconflow.cn/v1/embeddings"
				: "https://api.deepinfra.com/v1/openai/embeddings",
		);
		assert.equal(
			new Headers(init.headers).get("authorization"),
			`Bearer ${sf ? keys.SILICONFLOW_API_KEY : keys.DEEPINFRA_API_KEY}`,
		);
		assert.deepEqual(JSON.parse(String(init.body)), {
			model: "Qwen/Qwen3-Embedding-4B",
			input: "query",
			encoding_format: "float",
			...(sf ? { dimensions: 2560 } : {}),
		});
		calls.push(sf ? "A" : "B");
		return reply(calls.length, init);
	});
	const service = new EmbeddingService(
		env,
		(_key, message) => alerts.push(message),
		(event) => usage.push(event),
	);
	return {
		calls,
		timers,
		usage,
		alerts,
		reasons,
		run: (signal?: AbortSignal) =>
			service.createEmbedding(" query ", signal, (reason) => reasons.push(reason)),
	};
}

for (const successfulAttempt of [1, 2, 3, 4, 0]) {
	test(`serial attempts stop on ${successfulAttempt || "exhaustion"} with one charge record per dispatch`, async (t) => {
		const h = harness(t, (i) => (i === successfulAttempt ? success() : unavailable()));
		if (successfulAttempt) {
			const result = await h.run();
			assert.deepEqual(result.slice(0, 2), [0.6, 0.8]);
			assert.equal(result.length, 2560);
		} else {
			await assert.rejects(h.run(), /HTTP 503/);
		}
		const count = successfulAttempt || 4;
		assert.equal(h.calls.join(""), "ABAB".slice(0, count));
		assert.deepEqual(
			h.timers.map((t) => t.ms),
			[16000, ...[3000, 3000, 5000, 5000].slice(0, count)],
		);
		assert.deepEqual(h.reasons, count > 1 ? ["EMBEDDING_FALLBACK"] : []);
		assert.equal(h.usage.length, count);
		assert.equal(
			h.usage.filter((e) => e.costNanos !== undefined).length,
			successfulAttempt ? 1 : 0,
		);
		if (successfulAttempt) {
			const last = h.usage.at(-1);
			assert.equal(last?.currency, count % 2 ? "CNY" : "USD");
			assert.equal(last?.costNanos, count % 2 ? 700 : 100);
		}
	});
}

test("an individual timeout switches provider; expiring the overall deadline stops the in-flight body and prevents more calls", async (t) => {
	const h = harness(t, async (i, init) => {
		const deadline = h.timers[i === 1 ? 1 : 0].controller;
		await Promise.resolve();
		deadline.abort(new DOMException("deadline", "TimeoutError"));
		assert.ok(init.signal?.aborted);
		init.signal.throwIfAborted();
		return success();
	});
	await assert.rejects(h.run(), { name: "TimeoutError" });
	assert.deepEqual(h.calls, ["A", "B"]);
	assert.equal(h.usage.length, 2);
});

for (const at of [0, 1, 2, 3, 4]) {
	test(`caller cancellation at attempt ${at} starts no further work`, async (t) => {
		const controller = new AbortController();
		const reason = new Error("Client disconnected");
		const h = harness(t, (i, init) => {
			if (i === at) {
				controller.abort(reason);
				assert.ok(init.signal?.aborted);
				throw reason;
			}
			return unavailable();
		});
		if (!at) controller.abort(reason);
		await assert.rejects(h.run(controller.signal), reason);
		assert.equal(h.calls.length, at);
		assert.equal(h.usage.length, at);
		assert.equal(h.alerts.length, Math.max(0, at - 1));
	});
}

test("an invalid key and an explicit retry-after skip only the affected provider", async (t) => {
	for (const [status, headers] of [
		[401, {}],
		[429, { "Retry-After": "60" }],
		[503, { "Retry-After": new Date(Date.now() + 60_000).toUTCString() }],
	] as const) {
		await t.test(String(status), async (st) => {
			const h = harness(st, (i) =>
				i === 1 ? new Response(null, { status, headers }) : i === 2 ? unavailable() : success(),
			);
			await h.run();
			assert.equal(h.calls.join(""), "ABB");
			assert.deepEqual(h.reasons, ["EMBEDDING_FALLBACK"]);
			assert.match(h.alerts[0], /SiliconFlow Embedding generation failed/);
		});
	}
});

test("a single configured provider gets one attempt per round", async (t) => {
	for (const primary of [false, true]) {
		await t.test(primary ? "SiliconFlow" : "DeepInfra", async (st) => {
			const h = harness(
				st,
				(i) => (i === 1 ? unavailable() : success()),
				primary ? { ...keys, DEEPINFRA_API_KEY: "" } : { ...keys, SILICONFLOW_API_KEY: "" },
			);
			await h.run();
			assert.equal(h.calls.join(""), primary ? "AA" : "BB");
			assert.deepEqual(
				h.timers.map((t) => t.ms),
				[16000, 3000, 5000],
			);
			assert.deepEqual(h.reasons, []);
		});
	}
});
test("unconfigured providers are never dispatched or metered", async (t) => {
	const h = harness(t, success, { SILICONFLOW_API_KEY: "", DEEPINFRA_API_KEY: "" });
	await assert.rejects(h.run(), /No embedding provider/);
	assert.equal(h.calls.length, 0);
	assert.equal(h.usage.length, 0);
});
test("a response must contain a usable vector before stopping the schedule", async (t) => {
	const invalid = [[1], Array(2560).fill(0), Array(2560).fill("1")];
	const h = harness(t, (i) =>
		i === 4
			? success()
			: Response.json({ data: [{ embedding: invalid[i - 1] }], usage: { prompt_tokens: 3 } }),
	);
	await h.run();
	assert.equal(h.calls.join(""), "ABAB");
	assert.deepEqual(
		h.usage.map((e) => e.inputTokens),
		[3, 3, 3, 5],
	);
});
