import assert from "node:assert/strict";
import test from "node:test";
import type { DigestStats, DocChangeEventItem } from "../../shared/doc-updates.js";
import { renderUpdatesRssXml } from "../api/routes/updates.js";
import {
	buildDeterministicDigest,
	estimateNeurons,
	extractJsonPayload,
	formatIsoWeekKey,
	formatUtcDayKey,
	sanitizeDigestUrls,
	WORKERS_AI_DIGEST_MODELS,
} from "./doc-digest.js";

test("estimateNeurons matches Cloudflare Workers AI pricing table and fits within 10k daily free tier", () => {
	const gptOss = WORKERS_AI_DIGEST_MODELS[0]!;
	const deepseek = WORKERS_AI_DIGEST_MODELS[1]!;
	const gemma = WORKERS_AI_DIGEST_MODELS[2]!;

	// 15K input + 3.5K output on gpt-oss-120b => ~716 neurons (<8% of 10k daily free quota)
	const gptOssNeurons = estimateNeurons(gptOss, 15_000, 3_500);
	assert.ok(gptOssNeurons > 650 && gptOssNeurons < 800, `got ${gptOssNeurons}`);

	// 15K input + 3.5K output on deepseek-v4.1-flash-1017 => ~791 neurons (<8% of 10k daily free quota)
	const deepseekNeurons = estimateNeurons(deepseek, 15_000, 3_500);
	assert.ok(deepseekNeurons > 700 && deepseekNeurons < 900, `got ${deepseekNeurons}`);

	// 15K input + 2.5K output on gemma-4-26b-a4b-it => ~205 neurons (~2% of daily free quota)
	const gemmaNeurons = estimateNeurons(gemma, 15_000, 2_500);
	assert.ok(gemmaNeurons > 180 && gemmaNeurons < 240, `got ${gemmaNeurons}`);
});

test("extractJsonPayload parses fenced strings, Workers AI response wrappers, and OpenAI choices", () => {
	const sample = { en: { headline: "A" }, zh: { headline: "甲" } };
	assert.deepEqual(extractJsonPayload(`\`\`\`json\n${JSON.stringify(sample)}\n\`\`\``), sample);
	assert.deepEqual(extractJsonPayload({ response: JSON.stringify(sample) }), sample);
	assert.deepEqual(
		extractJsonPayload({ choices: [{ message: { content: JSON.stringify(sample) } }] }),
		sample,
	);
	assert.equal(extractJsonPayload("not json at all"), null);
});

test("sanitizeDigestUrls drops hallucinated links while preserving verified evidence URLs", () => {
	const allowed = new Set(["https://developer.apple.com/documentation/swiftui/view"]);
	const cleaned = sanitizeDigestUrls(
		{
			en: {
				headline: "SwiftUI updates",
				overview: "Verified SwiftUI updates across docs.",
				strategy_notes: ["Focus on SwiftUI"],
				highlights: [
					{
						framework: "SwiftUI",
						title: "View updated",
						summary: "Updated View docs.",
						urls: [
							"https://developer.apple.com/documentation/swiftui/view",
							"https://developer.apple.com/documentation/swiftui/hallucinated",
						],
					},
				],
				alerts: [
					{
						kind: "deprecated",
						framework: "SwiftUI",
						title: "Fake",
						note: "Should drop",
						url: "https://developer.apple.com/documentation/swiftui/fake",
					},
					{
						kind: "beta",
						framework: "SwiftUI",
						title: "View",
						note: "Valid beta alert",
						url: "https://developer.apple.com/documentation/swiftui/view",
					},
				],
			},
			zh: {
				headline: "SwiftUI 更新",
				overview: "SwiftUI 文档出现更新。",
				strategy_notes: ["聚焦 SwiftUI"],
				highlights: [],
				alerts: [],
			},
		},
		allowed,
	);

	assert.deepEqual(cleaned.en.highlights[0]?.urls, [
		"https://developer.apple.com/documentation/swiftui/view",
	]);
	assert.equal(cleaned.en.alerts.length, 1);
	assert.equal(cleaned.en.alerts[0]?.url, "https://developer.apple.com/documentation/swiftui/view");
});

test("buildDeterministicDigest and renderUpdatesRssXml produce valid bilingual and RSS output", () => {
	assert.equal(formatUtcDayKey(new Date("2026-11-25T10:00:00Z")), "2026-11-25");
	assert.equal(formatIsoWeekKey(new Date("2026-11-25T10:00:00Z")), "2026-W48");

	const stats: DigestStats = {
		total_events: 2,
		high_significance: 1,
		frameworks_touched: 1,
		by_kind: { deprecated: 1, added: 1 },
		top_frameworks: [{ framework: "SwiftUI", count: 2 }],
	};
	const events: DocChangeEventItem[] = [
		{
			id: 1,
			url: "https://developer.apple.com/documentation/swiftui/oldapi",
			framework: "SwiftUI",
			title: "OldAPI & Helpers",
			symbol_kind: "struct",
			change_kind: "deprecated",
			significance: "high",
			sweep_source: "radar",
			summary: "Marked deprecated in SwiftUI",
			change_flags: { deprecated_added: true },
			diff_snippet: "+ Deprecated",
			source_modified_at: null,
			detected_at: "2026-11-25T01:00:00.000Z",
		},
	];

	const fallback = buildDeterministicDigest("daily", "2026-11-25", stats, events);
	assert.match(fallback.en.headline, /SwiftUI/);
	assert.match(fallback.zh.headline, /SwiftUI/);
	assert.equal(fallback.en.alerts.length, 1);
	assert.equal(fallback.zh.alerts.length, 1);

	const rss = renderUpdatesRssXml([], events);
	assert.match(rss, /<rss version="2.0"/);
	assert.match(rss, /OldAPI &amp; Helpers/);
	assert.doesNotMatch(rss, /OldAPI & Helpers/);
});
