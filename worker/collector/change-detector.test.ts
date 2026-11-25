import assert from "node:assert/strict";
import test from "node:test";
import { AppleAPIClient } from "./AppleAPIClient.js";
import {
	buildCompactUnifiedDiff,
	createRemovedDocChange,
	detectDocumentChange,
} from "./change-detector.js";

test("formatting-only whitespace churn is filtered out as zero change", () => {
	const result = detectDocumentChange({
		url: "https://developer.apple.com/documentation/swiftui/view",
		oldTitle: "View",
		oldContent: "# View\n\nA type that represents part of your app's UI.\n",
		newTitle: "View",
		newContent: "# View  \r\n\r\n\r\nA type that represents part of your app's UI.  ",
		sweepSource: "sweep",
	});
	assert.equal(result, null);
});

test("newly indexed pages classify as added or video_added with preview diff", () => {
	const doc = detectDocumentChange({
		url: "https://developer.apple.com/documentation/foundationmodels/systemlanguagemodel",
		oldTitle: null,
		oldContent: "",
		newTitle: "SystemLanguageModel",
		newContent: "# SystemLanguageModel\n\nAn on-device language model.",
		newRawJson: {
			metadata: {
				modules: [{ name: "FoundationModels" }],
				symbolKind: "class",
				platforms: [{ name: "iOS", introducedAt: "26.0", beta: true }],
			},
		},
		sweepSource: "radar",
	});
	assert.ok(doc);
	assert.equal(doc.change_kind, "added");
	assert.equal(doc.significance, "high");
	assert.equal(doc.framework, "FoundationModels");
	assert.equal(doc.change_flags.beta_added, true);
	assert.match(doc.diff_snippet ?? "", /^\+ # SystemLanguageModel/);

	const video = detectDocumentChange({
		url: "https://developer.apple.com/videos/play/wwdc2026/101",
		oldTitle: null,
		oldContent: "",
		newTitle: "What's new in SwiftUI",
		newContent: "Welcome to WWDC.",
		sweepSource: "sweep",
	});
	assert.ok(video);
	assert.equal(video.change_kind, "video_added");
	assert.equal(video.framework, "WWDC Videos");
	assert.equal(video.sweep_source, "videos");
});

test("DocC metadata detects deprecation, beta graduation, and declaration/platform changes", () => {
	const deprecated = detectDocumentChange({
		url: "https://developer.apple.com/documentation/uikit/uiwebview",
		oldTitle: "UIWebView",
		oldContent: "A view that embeds web content.",
		oldRawJson: {
			metadata: { modules: [{ name: "UIKit" }], platforms: [{ name: "iOS", introducedAt: "2.0" }] },
		},
		newTitle: "UIWebView",
		newContent: "A view that embeds web content.\n\nUse WKWebView instead.",
		newRawJson: {
			metadata: {
				modules: [{ name: "UIKit" }],
				platforms: [{ name: "iOS", introducedAt: "2.0", deprecatedAt: "12.0" }],
			},
			deprecationSummary: [{ type: "paragraph" }],
		},
		sweepSource: "sweep",
	});
	assert.ok(deprecated);
	assert.equal(deprecated.change_kind, "deprecated");
	assert.equal(deprecated.significance, "high");
	assert.equal(deprecated.change_flags.deprecated_added, true);

	const graduated = detectDocumentChange({
		url: "https://developer.apple.com/documentation/swiftui/navigationstack",
		oldTitle: "NavigationStack",
		oldContent: "A view that displays a root view.",
		oldRawJson: {
			metadata: {
				modules: [{ name: "SwiftUI" }],
				platforms: [{ name: "visionOS", introducedAt: "2.0", beta: true }],
			},
		},
		newTitle: "NavigationStack",
		newContent: "A view that displays a root view.",
		newRawJson: {
			metadata: {
				modules: [{ name: "SwiftUI" }],
				platforms: [{ name: "visionOS", introducedAt: "2.0", beta: false }],
			},
		},
		sweepSource: "radar",
	});
	assert.ok(graduated);
	assert.equal(graduated.change_kind, "beta_changed");
	assert.equal(graduated.significance, "high");
	assert.equal(graduated.change_flags.beta_removed, true);

	const sig = detectDocumentChange({
		url: "https://developer.apple.com/documentation/swiftui/text/init",
		oldTitle: "init(_:)",
		oldContent: "Creates a text view.",
		oldRawJson: {
			metadata: {
				modules: [{ name: "SwiftUI" }],
				platforms: [{ name: "iOS", introducedAt: "13.0" }],
			},
			primaryContentSections: [
				{ kind: "declarations", declarations: [{ tokens: [{ text: "init(_ text: String)" }] }] },
			],
		},
		newTitle: "init(_:)",
		newContent: "Creates a text view with localization.",
		newRawJson: {
			metadata: {
				modules: [{ name: "SwiftUI" }],
				platforms: [
					{ name: "iOS", introducedAt: "13.0" },
					{ name: "visionOS", introducedAt: "1.0" },
				],
			},
			primaryContentSections: [
				{
					kind: "declarations",
					declarations: [{ tokens: [{ text: "init(_ text: LocalizedStringKey)" }] }],
				},
			],
		},
		sweepSource: "sweep",
	});
	assert.ok(sig);
	assert.equal(sig.change_kind, "signature_changed");
	assert.equal(sig.significance, "high");
	assert.equal(sig.change_flags.declaration_changed, true);
	assert.deepEqual(sig.change_flags.platforms_added, ["visionOS 1.0+"]);
});

test("buildCompactUnifiedDiff produces crisp added/removed lines and createRemovedDocChange marks high", () => {
	const diff = buildCompactUnifiedDiff(
		"Line 1\nOld behavior\nLine 3",
		"Line 1\nNew behavior\nExtra detail\nLine 3",
	);
	assert.equal(diff.linesAdded, 2);
	assert.equal(diff.linesRemoved, 1);
	assert.match(diff.snippet ?? "", /- Old behavior/);
	assert.match(diff.snippet ?? "", /\+ New behavior/);

	const removed = createRemovedDocChange({
		url: "https://developer.apple.com/documentation/coreml/legacyapi",
		title: "LegacyAPI",
		sweepSource: "sweep",
	});
	assert.equal(removed.change_kind, "removed");
	assert.equal(removed.significance, "high");
	assert.equal(removed.framework, "Core ML");
});

test("AppleAPIClient sends If-None-Match and treats HTTP 304 as notModified", async (t) => {
	let seenHeader: string | null = null;
	t.mock.method(globalThis, "fetch", async (_input: unknown, init?: RequestInit) => {
		const headers = init?.headers as Record<string, string> | undefined;
		seenHeader = headers?.["If-None-Match"] ?? null;
		return new Response(null, { status: 304, headers: { ETag: '"abc-123"' } });
	});

	const client = new AppleAPIClient();
	const url = "https://developer.apple.com/documentation/swiftui";
	const results = await client.fetchDocuments([url], undefined, new Map([[url, '"abc-123"']]));
	assert.equal(seenHeader, '"abc-123"');
	assert.equal(results[0]?.notModified, true);
	assert.equal(results[0]?.data, null);
	assert.equal(results[0]?.etag, '"abc-123"');
});
