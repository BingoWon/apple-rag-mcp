import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import { ChangeEventCard } from "@/components/updates/ChangeEventCard";
import { DigestPanel } from "@/components/updates/DigestPanel";
import i18n from "@/i18n";
import {
	type DocChangeDigest,
	type DocChangeEventItem,
	extractFrameworkFromUrl,
} from "../../shared/doc-updates";

const sampleDigest: DocChangeDigest = {
	id: 1,
	period_type: "daily",
	period_key: "2026-11-25",
	window_start: "2026-11-24T00:00:00.000Z",
	window_end: "2026-11-25T00:00:00.000Z",
	status: "ready",
	provider: "cloudflare-workers-ai",
	model: "@cf/deepseek-ai/deepseek-v4.1-flash-1017",
	neurons_estimated: 780,
	stats: {
		total_events: 12,
		high_significance: 4,
		frameworks_touched: 3,
		by_kind: { added: 6, deprecated: 2, content_revised: 4 },
		top_frameworks: [{ framework: "SwiftUI", count: 7 }],
	},
	content_en: {
		headline: "SwiftUI and FoundationModels lead today's Apple doc updates",
		overview: "Twelve updates landed across SwiftUI, FoundationModels, and Xcode.",
		strategy_notes: ["Expanded on-device model guidance."],
		highlights: [
			{
				framework: "SwiftUI",
				title: "Navigation updates",
				summary: "Clarified NavigationStack path behavior.",
				urls: ["https://developer.apple.com/documentation/swiftui/navigationstack"],
			},
		],
		alerts: [
			{
				kind: "deprecated",
				framework: "UIKit",
				title: "LegacyView",
				note: "Marked deprecated on iOS 26.",
				url: "https://developer.apple.com/documentation/uikit/legacyview",
			},
		],
	},
	content_zh: {
		headline: "SwiftUI 与 FoundationModels 领衔今日 Apple 文档更新",
		overview: "今日共捕获 12 项文档更新，覆盖 SwiftUI、FoundationModels 与 Xcode。",
		strategy_notes: ["持续补齐端侧模型开发说明。"],
		highlights: [
			{
				framework: "SwiftUI",
				title: "导航栈文档修订",
				summary: "补充了 NavigationStack 路径绑定边界说明。",
				urls: ["https://developer.apple.com/documentation/swiftui/navigationstack"],
			},
		],
		alerts: [
			{
				kind: "deprecated",
				framework: "UIKit",
				title: "LegacyView",
				note: "在 iOS 26 中新增废弃提示。",
				url: "https://developer.apple.com/documentation/uikit/legacyview",
			},
		],
	},
	generated_at: "2026-11-25T00:07:00.000Z",
};

const sampleEvent: DocChangeEventItem = {
	id: 42,
	url: "https://developer.apple.com/documentation/swiftui/navigationstack",
	framework: "SwiftUI",
	title: "NavigationStack",
	symbol_kind: "struct",
	change_kind: "content_revised",
	significance: "high",
	sweep_source: "radar",
	summary: "Documentation revised in SwiftUI · +8 / -2 lines",
	change_flags: { lines_added: 8, lines_removed: 2 },
	diff_snippet: "+ Added binding guidance\n- Removed old note",
	source_modified_at: "2026-11-24T22:00:00.000Z",
	detected_at: "2026-11-25T00:01:00.000Z",
};

test("extractFrameworkFromUrl resolves canonical Apple framework display names", () => {
	assert.equal(
		extractFrameworkFromUrl("https://developer.apple.com/documentation/swiftui/view"),
		"SwiftUI",
	);
	assert.equal(
		extractFrameworkFromUrl("https://developer.apple.com/documentation/foundationmodels"),
		"FoundationModels",
	);
	assert.equal(
		extractFrameworkFromUrl("https://developer.apple.com/documentation/xcode-release-notes"),
		"Xcode Release Notes",
	);
	assert.equal(
		extractFrameworkFromUrl("https://developer.apple.com/videos/play/wwdc2026/101"),
		"WWDC Videos",
	);
});

test("DigestPanel and ChangeEventCard render bilingual content with semantic theme tokens only", async () => {
	await i18n.changeLanguage("zh");
	const digestHtml = renderToStaticMarkup(
		createElement(
			I18nextProvider,
			{ i18n },
			createElement(DigestPanel, {
				period: "daily",
				onPeriodChange: () => {},
				digests: [sampleDigest],
				selectedKey: "2026-11-25",
				onSelectKey: () => {},
				loading: false,
				onFilterFramework: () => {},
			}),
		),
	);

	assert.match(digestHtml, /SwiftUI 与 FoundationModels 领衔今日 Apple 文档更新/);
	assert.match(digestHtml, /Cloudflare Workers AI · deepseek-v4.1-flash-1017/);
	assert.match(digestHtml, /废弃预警/);
	assert.doesNotMatch(digestHtml, /\bdark:/);
	assert.doesNotMatch(digestHtml, /#2563eb/i);
	assert.doesNotMatch(digestHtml, /\bblue-600\b/);

	await i18n.changeLanguage("en");
	const eventHtml = renderToStaticMarkup(
		createElement(
			I18nextProvider,
			{ i18n },
			createElement(ChangeEventCard, {
				event: sampleEvent,
				onFilterFramework: () => {},
			}),
		),
	);
	assert.match(eventHtml, /NavigationStack/);
	assert.match(eventHtml, /Hot Radar/);
	assert.match(eventHtml, /View diff/);
	assert.doesNotMatch(eventHtml, /\bdark:/);
	assert.doesNotMatch(eventHtml, /#2563eb/i);
});
