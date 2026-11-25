#!/usr/bin/env node
/**
 * Run independent verification commands concurrently across CPU cores,
 * buffering output per task so logs never interleave and surfacing full
 * diagnostics only for failing tasks.
 *
 * Usage:
 *   node ops/scripts/run-parallel.mjs "label::command" ...
 */
import { spawn } from "node:child_process";

const specs = process.argv.slice(2).map((arg) => {
	const sep = arg.indexOf("::");
	if (sep === -1) return { label: arg, command: arg };
	return { label: arg.slice(0, sep), command: arg.slice(sep + 2) };
});

if (specs.length === 0) {
	console.error("Usage: run-parallel.mjs <label::command> ...");
	process.exit(2);
}

const startedAll = Date.now();

const results = await Promise.all(
	specs.map(
		({ label, command }) =>
			new Promise((resolve) => {
				const started = Date.now();
				const child = spawn(command, {
					shell: true,
					stdio: ["ignore", "pipe", "pipe"],
					env: process.env,
				});
				let output = "";
				child.stdout.on("data", (chunk) => {
					output += chunk.toString();
				});
				child.stderr.on("data", (chunk) => {
					output += chunk.toString();
				});
				child.on("close", (code, signal) => {
					const seconds = ((Date.now() - started) / 1000).toFixed(2);
					const ok = code === 0 && !signal;
					const mark = ok ? "✓" : "✗";
					console.log(`${mark} ${label} (${seconds}s)`);
					resolve({ label, ok, code: code ?? 1, signal, output });
				});
			}),
	),
);

const failed = results.filter((result) => !result.ok);
const totalSeconds = ((Date.now() - startedAll) / 1000).toFixed(2);

if (failed.length > 0) {
	for (const item of failed) {
		console.error(`\n── ${item.label} failed (exit ${item.code}) ──`);
		if (item.output.trim()) console.error(item.output.trim());
	}
	console.error(`\nFailed ${failed.length}/${results.length} tasks in ${totalSeconds}s.`);
	process.exit(1);
}

console.log(`All ${results.length} tasks passed in ${totalSeconds}s.`);
