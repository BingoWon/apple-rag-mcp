import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAppleUrl } from "./url-utils.js";

test("normalizes Apple paths to one canonical lowercase URL", () => {
	assert.equal(
		normalizeAppleUrl("HTTPS://Developer.Apple.com/documentation/AppKit/NSView/"),
		"https://developer.apple.com/documentation/appkit/nsview",
	);
});
