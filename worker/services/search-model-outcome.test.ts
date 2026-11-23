import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "../shared/types.js";
import { RAGService } from "./rag.js";

test("concurrent searches persist their own attempts and notify only after the final retrieval outcome", async (t) => {
	const sqlite = new DatabaseSync(":memory:");
	t.after(() => sqlite.close());
	const migrate = (file: string) =>
		sqlite.exec(readFileSync(new URL(`../../migrations/${file}.sql`, import.meta.url), "utf8"));
	migrate("0013_model_usage");
	sqlite.exec(
		"INSERT INTO model_usage_events(created_at,category) VALUES ('2026-01-01','embedding')",
	);
	migrate("0018_model_attempts");
	migrate("0019_ranking_model");
	const pending: Promise<unknown>[] = [];
	const messages: string[] = [];
	const cancel = new AbortController();
	const dispatched = new Map<string, number>();
	const alertUrl = "https://example.invalid/search-outcome";
	const db = {
		prepare: (sql: string) => ({
			bind:
				(...values: (string | number | null)[]) =>
				() =>
					sqlite.prepare(sql).run(...values),
		}),
		batch: async (statements: (() => unknown)[]) => statements.map((run) => run()),
	};
	const rag = new RAGService(
		{
			RAG_DB_HOST: "localhost",
			RAG_DB_PORT: 1,
			RAG_DB_DATABASE: "test",
			RAG_DB_USER: "test",
			RAG_DB_PASSWORD: "",
			RAG_DB_SSLMODE: "disable",
		},
		{
			DB: db,
			SILICONFLOW_API_KEY: "test-primary",
			DEEPINFRA_API_KEY: "test-backup",
			TYPESAFE_API_KEY: "test-ranking",
			TELEGRAM_ALERT_BOT_URL: alertUrl,
		} as unknown as Env,
		{ waitUntil: (promise) => pending.push(promise) },
		"cli",
	);
	t.after(() => rag.database.close());
	const document = {
		id: "1",
		title: "Swift",
		content: "Swift",
		contentLength: 5,
		url: "https://developer.apple.com/documentation/swift",
		total_chunks: 1,
		chunk_index: 0,
	};
	t.mock.method(rag.database, "semanticSearch", async () => [document]);
	t.mock.method(rag.database, "keywordSearch", async (query: string) => {
		if (query === "failed") throw new Error("keyword database unavailable");
		return query === "empty" ? [] : [document];
	});
	t.mock.method(globalThis, "fetch", async (url, init) => {
		if (String(url).endsWith("/cdn-cgi/trace")) return new Response("colo=SIN");
		const body = JSON.parse(String(init.body));
		if (url === alertUrl) {
			messages.push(body.text);
			return Response.json({ ok: true });
		}
		if (String(url).endsWith("/embeddings")) {
			const query: string = body.input;
			const attempt = (dispatched.get(query) ?? 0) + 1;
			dispatched.set(query, attempt);
			if (query === "cancelled") {
				cancel.abort();
				init.signal.throwIfAborted();
			}
			if (query === "healthy" || (query === "recovered" && attempt === 4))
				return Response.json({
					data: [{ embedding: Array(2560).fill(1) }],
					usage: { prompt_tokens: 7 },
				});
			return new Response(null, { status: 503 });
		}
		if (String(url).includes("api.typesafe.ai")) {
			if (body.state.query === "recovered") return new Response(null, { status: 503 });
			return Response.json({ model: "jev-test", answers: { d0: { type: "score", score: 2 } } });
		}
		assert.ok(String(url).endsWith("Qwen/Qwen3-Reranker-8B"));
		return Response.json({ scores: [1] });
	});

	const run = (query: string) =>
		rag.query({
			query,
			trace: { requestId: `req-${query}`, country: "US" },
			signal: query === "cancelled" ? cancel.signal : undefined,
		});
	const [healthy, recovered, keyword, empty] = await Promise.all([
		run("healthy"),
		run("recovered"),
		run("keyword"),
		run("empty"),
		assert.rejects(run("failed"), /both failed/),
		assert.rejects(run("cancelled"), { name: "AbortError" }),
	]);
	await Promise.all(pending);
	assert.deepEqual(healthy.degradations, []);
	assert.equal(recovered.count, 1);
	assert.deepEqual(keyword.degradations, ["EMBEDDING_FALLBACK", "SEMANTIC_UNAVAILABLE"]);
	assert.equal(empty.count, 0);
	assert.equal(messages.length, 4);
	const message = (query: string) =>
		messages.find((text) => text.includes(`request_id=req-${query} `)) ?? "";
	assert.match(
		message("recovered"),
		/Search completed after embedding recovery: results=1, elapsed_ms=\d+/,
	);
	assert.match(message("recovered"), /#4 DeepInfra success/);
	assert.match(message("recovered"), /Fallback Qwen3-Reranker-8B succeeded/);
	assert.match(message("keyword"), /Keyword-only search: results=1/);
	assert.match(message("empty"), /Keyword-only search: results=0/);
	assert.match(message("failed"), /Search failed: results=0/);
	const attempts = sqlite.prepare(
		"SELECT provider, attempt_no, timeout_ms, attempt_outcome, http_status, input_tokens FROM model_usage_events WHERE request_id=? AND category='embedding' ORDER BY attempt_no",
	);
	assert.deepEqual(
		attempts.all("req-recovered").map((row) => Object.values(row)),
		[
			["SiliconFlow", 1, 3000, "http_error", 503, null],
			["DeepInfra", 2, 3000, "http_error", 503, null],
			["SiliconFlow", 3, 5000, "http_error", 503, null],
			["DeepInfra", 4, 5000, "success", null, 7],
		],
	);
	assert.equal(attempts.all("req-cancelled")[0]?.attempt_outcome, "cancelled");
	assert.equal(attempts.all("req-healthy").length, 1);
	assert.equal(
		sqlite.prepare("SELECT count(*) AS n FROM model_usage_events WHERE request_id IS NULL").get()
			?.n,
		1,
	);
});
