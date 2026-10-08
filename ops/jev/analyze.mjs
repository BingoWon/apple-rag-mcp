import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { summarize } from "./evaluate.mjs";

const [mainDir, positiveDir, controlsDir] = process.argv.slice(2);
assert.ok(mainDir && positiveDir && controlsDir, "Usage: node analyze.mjs MAIN POSITIVE CONTROLS");
const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const main = read(`${mainDir}/results.json`);
const positive = read(`${positiveDir}/results.json`);
const controls = read(`${controlsDir}/results.json`);
const repetitions = [
	...read(`${mainDir}/repetitions.json`),
	...read(`${positiveDir}/repetitions.json`),
];
const baselines = [...main, ...positive];
const stability = repetitions.map((record) => {
	const base = baselines.find((row) => row.query === record.query);
	const before = base.response.answers;
	const after = record.response.answers;
	const keys = Object.keys(before).filter((key) => key.startsWith("score_"));
	return {
		query: record.query,
		reversed: record.order[0] !== "d1",
		original_choice: before.best.choice,
		repeated_choice: after.best.choice,
		choice_changed: before.best.choice !== after.best.choice,
		mean_score_delta:
			keys.reduce((sum, key) => sum + Math.abs(before[key].score - after[key].score), 0) /
			keys.length,
	};
});
const labels = controls.map((record) => {
	assert.equal(typeof record.expected_useful, "boolean");
	const probability = record.response.answers.useful_d1.noul;
	return {
		query: record.query,
		expected: record.expected_useful,
		probability,
		uncertain: probability >= 0.4 && probability <= 0.6,
		passed: record.expected_useful ? probability > 0.6 : probability < 0.4,
		score: record.response.answers.score_d1.score,
		choice: record.response.answers.best.choice,
	};
});
const review = main.map((record) => {
	const answers = record.response.answers;
	const ranked = record.candidates
		.map((doc) => ({
			id: doc.id,
			title: doc.title,
			url: doc.url,
			score: answers[`score_${doc.id}`].score,
			usefulness: answers[`useful_${doc.id}`].noul,
			confidence: answers[`score_${doc.id}`].confidence,
		}))
		.sort((a, b) => b.score - a.score);
	return {
		query: record.query,
		choice: answers.best.choice,
		choice_confidence: answers.best.confidence,
		answerability: answers.answerable.noul,
		top_four: ranked.slice(0, 4),
	};
});
const summary = {
	main: summarize(main),
	all_formal_requests: summarize([...main, ...positive, ...repetitions, ...controls]),
	controls: {
		total: labels.length,
		passed: labels.filter((row) => row.passed).length,
		uncertain: labels.filter((row) => row.uncertain).length,
		false_positive: labels.filter((row) => !row.expected && row.probability > 0.6).length,
		false_negative: labels.filter((row) => row.expected && row.probability < 0.4).length,
	},
	stability: {
		repetitions: stability.length,
		choice_changes: stability.filter((row) => row.choice_changed).length,
		reversed_choice_changes: stability.filter((row) => row.reversed && row.choice_changed).length,
		mean_score_delta:
			stability.reduce((sum, row) => sum + row.mean_score_delta, 0) / stability.length,
	},
	main_selected_none: review.filter((row) => row.choice === "none").length,
	main_answerability_at_0_6: review.filter((row) => row.answerability >= 0.6).length,
};
writeFileSync(
	`${mainDir}/analysis.json`,
	JSON.stringify({ summary, stability, labels, review }, null, 2),
	{
		mode: 0o600,
	},
);
console.log(JSON.stringify(summary, null, 2));
