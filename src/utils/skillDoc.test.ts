import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const skillDirectory = new URL("../../skills/apple-dev-docs/", import.meta.url);
const skillFile = new URL("SKILL.md", skillDirectory);
const source = readFileSync(skillFile, "utf8");

function parseFrontmatter(): { fields: Record<string, string>; body: string } {
	const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
	assert.ok(match, "SKILL.md must start with YAML frontmatter");
	const fields: Record<string, string> = {};
	let current: string | undefined;
	for (const line of match[1].split("\n")) {
		const field = line.match(/^([a-z-]+):\s*(.*)$/);
		if (field) {
			current = field[1];
			fields[current] = field[2] === ">-" ? "" : field[2];
			continue;
		}
		if (current && /^\s+\S/.test(line)) {
			fields[current] = `${fields[current]} ${line.trim()}`.trim();
		}
	}
	return { fields, body: match[2] };
}

test("skill metadata satisfies the Agent Skills format", () => {
	const { fields } = parseFrontmatter();
	assert.equal(fields.name, basename(fileURLToPath(skillDirectory)));
	assert.ok(fields.description.length <= 1024);
	assert.match(fields.description, /Use when/);
	assert.equal(fields.license, "MIT");
	assert.ok(
		!source.includes("allowed-tools"),
		"Agent-specific fields reduce cross-client compatibility",
	);
});

test("skill stays a focused, portable instruction file", () => {
	const { body } = parseFrontmatter();
	assert.ok(source.split("\n").length <= 250);
	assert.match(body, /https:\/\/mcp\.apple-rag\.com/);
	assert.match(body, /\bsearch\b/);
	assert.match(body, /\bbrowse\b/);
	assert.match(body, /\bfetch\b/);
	assert.ok(
		!existsSync(new URL("README.md", skillDirectory)),
		"Skill folders must not ship a README.md",
	);
});

test("skill version stays in sync with apple-rag-cli package version", () => {
	const cliPackage = JSON.parse(
		readFileSync(new URL("../../packages/cli/package.json", import.meta.url), "utf8"),
	) as { version: string };
	const versionMatch = source.match(/^metadata:\n(?:\s+.*\n)*?\s+version:\s*"([^"]+)"/m);
	assert.ok(versionMatch, "SKILL.md frontmatter must include metadata.version");
	assert.equal(versionMatch[1], cliPackage.version);
});

test("skill explains tier-aware access without requiring a subscription for trial use", () => {
	const text = source.replace(/\s+/g, " ");
	assert.match(text, /anonymous 30\/week, 3\/minute/);
	assert.match(text, /signed-in free 50\/week, 5\/minute/);
	assert.match(text, /Pro 50,000\/week, 50\/minute/);
	assert.match(text, /auth status/);
	assert.match(text, /Invalid\/revoked explicit credentials must stop/);
	assert.match(text, /Paid users at minute limits should wait/);
	assert.doesNotMatch(text, /must subscribe|paid account required|unlimited free access/i);
});
