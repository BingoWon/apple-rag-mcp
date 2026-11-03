import assert from "node:assert/strict";
import test from "node:test";
import { loginPage } from "../src/login-page.js";

test("standalone login pages are localized, self-contained, accessible and escape their only URL input", () => {
	for (const language of ["en", "zh"])
		for (const state of ["success", "denied", "error"] as const) {
			const html = loginPage(
				state,
				'https://example.com/"<script>alert(1)</script>',
				language,
				'dark" onload="x',
			);
			assert.match(html, /name="viewport"/);
			assert.match(html, /<h1/);
			assert.match(html, /prefers-reduced-motion/);
			assert.match(html, /role="(?:status|alert)"/);
			assert(!html.includes("<script>"));
			assert(!html.includes('onload="x'));
			assert(html.includes("&quot;&lt;script&gt;"));
			assert(!html.includes("http://127.0.0.1"));
			assert(!html.includes("fonts.googleapis"));
		}
});
