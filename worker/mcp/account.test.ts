import assert from "node:assert/strict";
import test from "node:test";
import type { Env } from "../shared/types.js";
import { handleAccountRequest } from "./account.js";

test("account status errors are private, uncached, and never become anonymous access", async () => {
	for (const [authorization, status, code] of [
		["invalid", 401, "INVALID_TOKEN"],
		["Bearer at_00000000000000000000000000000000", 503, "SERVICE_UNAVAILABLE"],
	] as const) {
		const response = await handleAccountRequest(
			new Request("https://mcp.apple-rag.com/account", {
				headers: { Authorization: authorization },
			}),
			{
				DB: {
					prepare() {
						throw new Error("private database diagnostic");
					},
				},
			} as unknown as Env,
			{ waitUntil() {} },
		);
		assert.equal(response.status, status);
		assert.equal(response.headers.get("Cache-Control"), "no-store");
		const data = await response.text();
		assert.equal(JSON.parse(data).error.code, code);
		assert.doesNotMatch(data, /private database|at_0000|anonymous/i);
	}
});
