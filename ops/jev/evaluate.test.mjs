import assert from "node:assert/strict";
import test from "node:test";
import {
	buildRequest,
	excerpt,
	extractTerms,
	selectSearches,
	summarize,
	validateResponse,
} from "./evaluate.mjs";

test("samples real unique queries without exporting credentials or user identity", () => {
	const rows = Array.from({ length: 20 }, (_, index) => ({
		id: index,
		requested_query: `SwiftUI query ${index}`,
		actual_query: `SwiftUI query ${index}`,
		user_id: "private-user",
		mcp_token: "private-token",
	}));
	rows.unshift({ ...rows[0], requested_query: `at_${"a".repeat(32)} person@example.com` });
	const selected = selectSearches(rows, 8);
	assert.equal(selected.length, 8);
	assert.ok(!JSON.stringify(selected).includes("private-user"));
	assert.ok(!JSON.stringify(selected).includes("person@example.com"));
	assert.ok(!JSON.stringify(selected).includes(`at_${"a".repeat(32)}`));
	assert.equal(new Set(selected.map((row) => row.query)).size, 8);
});

test("extracts SQL-safe lexical terms and limits excerpts", () => {
	assert.deepEqual(extractTerms("SwiftUI NavigationStack path binding; DROP TABLE chunks --"), [
		"swiftui",
		"navigationstack",
		"path",
		"binding",
		"drop",
		"table",
		"chunks",
	]);
	const content = `${"intro ".repeat(1000)}NavigationStack path binding${" tail".repeat(1000)}`;
	assert.ok(excerpt(content, ["navigationstack"]).includes("NavigationStack"));
	assert.ok(excerpt(content, ["navigationstack"]).length <= 3500);
});

test("puts all three Jev primitives in one request without another model", () => {
	const sample = {
		query: "SwiftUI navigation",
		candidates: [
			{ id: "d1", url: "https://developer.apple.com", title: "NavigationStack", content: "Text" },
		],
	};
	const request = buildRequest(sample);
	assert.equal(request.model, "jev-latest");
	assert.deepEqual(Object.keys(request.questions), ["score_d1", "useful_d1", "best", "answerable"]);
	assert.deepEqual(
		new Set(Object.values(request.questions).map((question) => question.type)),
		new Set(["score", "noul", "choice"]),
	);
	assert.deepEqual(Object.keys(request.questions.best.criteria), ["d1", "none"]);
	assert.throws(() => validateResponse(request, { model: "jev-1.13.0", answers: {} }));
});

test("rejects another model and invalid typed answers", () => {
	const request = buildRequest({ query: "SwiftUI", candidates: [] });
	assert.throws(() => validateResponse(request, { model: "another-model", answers: {} }));
	assert.throws(() =>
		validateResponse(request, {
			model: "jev-1.13.0",
			answers: {
				best: { type: "choice", choice: "__proto__" },
				answerable: { type: "noul", noul: 0.5 },
			},
		}),
	);
	assert.throws(() =>
		validateResponse(request, {
			model: "jev-1.13.0",
			answers: {
				best: { type: "choice", choice: "none" },
				answerable: { type: "noul", noul: "0.5" },
			},
		}),
	);
});

test("summarizes real latency and reported usage without treating scores as accuracy", () => {
	const record = {
		response: { model: "jev-1.13.0" },
		attempts: [
			{
				http_status: 200,
				latency_ms: 250,
				body: { usage: { input_tokens: 1000, output_tokens: 10 } },
			},
		],
	};
	const result = summarize([record]);
	assert.equal(result.successes, 1);
	assert.equal(result.latency_ms.p95, 250);
	assert.equal(result.input_tokens, 1000);
	assert.ok(Math.abs(result.estimated_input_usd_at_0_042_per_million - 0.000042) < 1e-12);
	assert.equal("accuracy" in result, false);
});
