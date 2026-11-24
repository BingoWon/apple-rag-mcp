import assert from "node:assert/strict";
import test from "node:test";
import { cleanQuery, cleanQuerySafely } from "./query-cleaner.js";

test("preserves technical Apple developer terms, versions, ratios, and ordinary modal verbs", () => {
	const cases = [
		"SwiftUI view may not update on state change",
		"weak reference cycle in Swift closure",
		"UILayoutGuide safe area layout guide",
		"manual memory management in Objective-C",
		"UIResponder 1st responder chain",
		"3rd party framework linking",
		"iOS 18.2.10 Metal shader bug",
		"16:10 aspect ratio macOS window",
		"WWDC 2026 Swift concurrency",
		"Dec Oct Sep base conversion",
		"DocC symbol documentation link",
	];
	for (const query of cases) {
		const cleaned = cleanQuerySafely(query);
		if (query.includes("documentation")) {
			assert.equal(cleaned, "DocC symbol link");
		} else {
			assert.equal(cleaned, query, `Unexpectedly altered technical query: ${query} -> ${cleaned}`);
		}
	}
});

test("removes unambiguous temporal noise and filler words while keeping core technical query", () => {
	assert.equal(
		cleanQuery("SwiftUI NavigationStack 2026-10-15 today documentation"),
		"SwiftUI NavigationStack",
	);
	assert.equal(cleanQuery("Swift concurrency May 2025 tutorial"), "Swift concurrency");
	assert.equal(cleanQuery("Metal shader changes Oct 12 2025 10:30 AM"), "Metal shader changes");
	assert.equal(cleanQuery("SwiftUI examples of navigation"), "SwiftUI of navigation");
	assert.equal(cleanQuery("SwiftUI example code for List"), "SwiftUI example code for List");
});

test("falls back to original query when cleaning strips too much", () => {
	assert.equal(cleanQuerySafely("today 2026-10-15"), "today 2026-10-15");
});
