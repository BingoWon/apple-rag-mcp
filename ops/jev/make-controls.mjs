import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

const [input, output] = process.argv.slice(2);
assert.ok(input && output, "Usage: node make-controls.mjs DATASET OUTPUT");
const dataset = JSON.parse(readFileSync(input, "utf8"));
const targets = [
	[
		"Xcode download simulator runtimes",
		"/documentation/xcode/installing-additional-simulator-runtimes",
	],
	["AlarmKit AlarmManager schedule", "/documentation/alarmkit/scheduling-an-alarm-with-alarmkit"],
	["Swift Testing @Test", "/documentation/testing/migratingfromxctest"],
	["Managing model data", "/documentation/swiftui/managing-model-data-in-your-app"],
	["NSAlarmKitUsageDescription", "/videos/play/wwdc2025/230"],
	[
		"URLResourceValues isExcludedFromBackup",
		"/documentation/foundation/optimizing-your-app-s-data-for-icloud-backup",
	],
];
const positive = targets.map(([prefix, path]) => {
	const sample = dataset.samples.find((row) => row.query.startsWith(prefix));
	assert.ok(sample, `Missing actual query: ${prefix}`);
	const document = sample.candidates.find((doc) => new URL(doc.url).pathname === path);
	assert.ok(document, `Missing source document: ${path}`);
	return {
		...sample,
		candidates: [{ ...document, id: "d1" }],
		expected_useful: true,
		label_reason:
			"Actual query asks for the specific API/workflow directly discussed in this source.",
	};
});
const negative = positive.map((sample, index) => ({
	...sample,
	// Distinct frameworks/tasks give independently reviewable negative controls.
	candidates: [{ ...positive[(index + 1) % positive.length].candidates[0], id: "d1" }],
	expected_useful: false,
	label_reason: "Source addresses a different API/workflow and cannot help answer this query.",
}));
writeFileSync(
	output,
	JSON.stringify(
		{
			...dataset,
			sampling:
				"Six manually selected actual queries with one directly relevant source each; six unrelated-document controls using the same real queries and real sources",
			samples: [...positive, ...negative],
		},
		null,
		2,
	),
	{ mode: 0o600 },
);
console.log(`Wrote ${positive.length} positive and ${negative.length} negative controls`);
