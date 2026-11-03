import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("npm gate publishes only a new version of an existing package and fails on registry errors", () => {
	for (const [statuses, expected] of [
		[[200], false],
		[[404, 200], true],
		[[404, 404], false],
		[[503], null],
	]) {
		const directory = mkdtempSync(join(tmpdir(), "apple-rag-npm-gate-"));
		try {
			const output = join(directory, "output");
			const script = `const statuses = ${JSON.stringify(statuses)}; globalThis.fetch = async () => new Response('', {status: statuses.shift()}); await import(${JSON.stringify(new URL("./npm-release.mjs", import.meta.url).href)});`;
			const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
				encoding: "utf8",
				env: {
					...process.env,
					GITHUB_OUTPUT: output,
					GITHUB_STEP_SUMMARY: join(directory, "summary"),
				},
			});
			assert.equal(result.status, expected === null ? 1 : 0, result.stderr);
			if (expected !== null) assert.equal(readFileSync(output, "utf8"), `publish=${expected}\n`);
		} finally {
			rmSync(directory, { force: true, recursive: true });
		}
	}
});
