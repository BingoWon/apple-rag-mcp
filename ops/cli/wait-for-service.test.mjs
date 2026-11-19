import assert from "node:assert/strict";
import test from "node:test";
import { waitForService } from "./wait-for-service.mjs";

test("npm service gate requires matching production version and independent CLI API", async (t) => {
	const calls = [];
	t.mock.method(globalThis, "fetch", async (url) => {
		calls.push(url);
		return Response.json(
			url.endsWith("/api")
				? { version: "5.5.1" }
				: { channel: "cli", operations: ["search", "fetch", "browse"] },
		);
	});
	await waitForService("5.5.1", AbortSignal.timeout(1000));
	assert.equal(calls.length, 2);
});
test("stale production and broken CLI API cannot open the npm gate", async (t) => {
	for (const broken of ["version", "api"]) {
		const controller = new AbortController();
		t.mock.method(globalThis, "fetch", async (url) => {
			if (broken === "version" || url.endsWith("/health")) controller.abort();
			return Response.json(
				url.endsWith("/api")
					? { version: broken === "version" ? "old" : "5.5.1" }
					: { channel: "other" },
			);
		});
		await assert.rejects(waitForService("5.5.1", controller.signal));
		t.mock.restoreAll();
	}
});
