import assert from "node:assert/strict";
import test from "node:test";
import { safeAuthReturn } from "./auth-return.js";

test("login returns only to an internal path", () => {
	assert.equal(safeAuthReturn("/cli/authorize?request=test"), "/cli/authorize?request=test");
	for (const value of [
		null,
		undefined,
		"https://evil.test",
		"//evil.test",
		"/\\evil.test",
		"javascript:alert(1)",
	])
		assert.equal(safeAuthReturn(value), "/overview");
});
