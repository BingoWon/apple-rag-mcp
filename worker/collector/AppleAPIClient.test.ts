import assert from "node:assert/strict";
import test from "node:test";
import { AppleAPIClient } from "./AppleAPIClient.js";

const url = "https://developer.apple.com/documentation/test";

test("403 and unsupported document shapes never authorize deleting collected content", async (t) => {
	for (const response of [
		new Response("Blocked", { status: 403 }),
		Response.json({ metadata: { title: "Collection" }, topicSections: [] }),
	]) {
		t.mock.method(globalThis, "fetch", async () => response);
		const [result] = await new AppleAPIClient().fetchDocuments([url]);
		assert.ok(result.error);
		assert.doesNotMatch(result.error, /PERMANENT_ERROR/);
	}
});

test("a missing JSON endpoint does not delete a live HTML page", async (t) => {
	t.mock.method(globalThis, "fetch", async (input) =>
		String(input).endsWith(".json")
			? new Response("Not found", { status: 404 })
			: new Response("Live HTML"),
	);
	const [result] = await new AppleAPIClient().fetchDocuments([url]);
	assert.match(result.error!, /DOCUMENT_JSON_UNAVAILABLE/);
	assert.doesNotMatch(result.error!, /PERMANENT_ERROR/);
});

test("permanent document removal requires the original page to confirm 404 or 410", async (t) => {
	t.mock.method(globalThis, "fetch", async () => new Response("Removed", { status: 410 }));
	const [result] = await new AppleAPIClient().fetchDocuments([url]);
	assert.match(result.error!, /PERMANENT_ERROR:410/);
});

test("DocC paths map cleanly to swift.org without duplicating /documentation", async (t) => {
	const requested: string[] = [];
	t.mock.method(globalThis, "fetch", async (input) => {
		requested.push(String(input));
		return Response.json({
			metadata: { title: "DocC" },
			primaryContentSections: [{ kind: "content", content: [{ type: "paragraph" }] }],
		});
	});
	const [result] = await new AppleAPIClient().fetchDocuments([
		"https://developer.apple.com/documentation/docc/formatting-your-documentation-content",
	]);
	assert.ok(result.data);
	assert.equal(
		requested[0],
		"https://www.swift.org/data/documentation/docc/formatting-your-documentation-content.json",
	);
});

test("video titles decode HTML entities", async (t) => {
	t.mock.method(
		globalThis,
		"fetch",
		async () =>
			new Response(
				'<meta property="og:title" content="What&#x27;s new in SwiftUI &amp; UIKit"><section id="transcript-content"><span data-start="0.0">Hello world.</span></section>',
			),
	);
	const [result] = await new AppleAPIClient().fetchVideos([
		"https://developer.apple.com/videos/play/wwdc2026/101",
	]);
	assert.equal(result.data?.title, "What's new in SwiftUI & UIKit");
});
