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
