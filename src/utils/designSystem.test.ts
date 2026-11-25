import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const SRC_ROOT = path.resolve(process.cwd(), "src");

function walkSourceFiles(dir: string): string[] {
	const results: string[] = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			results.push(...walkSourceFiles(fullPath));
		} else if (/\.(tsx?|css)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) {
			results.push(fullPath);
		}
	}
	return results;
}

test("globals.css enforces single Tailwind v4 semantic token architecture", () => {
	const css = fs.readFileSync(path.join(SRC_ROOT, "styles/globals.css"), "utf8");

	assert.match(css, /@custom-variant dark \(&:where\(\.dark, \.dark \*\)\);/);
	assert.match(css, /:root\s*\{[\s\S]*?color-scheme:\s*light;/);
	assert.match(css, /\.dark\s*\{[\s\S]*?color-scheme:\s*dark;/);
	assert.match(css, /@theme inline\s*\{/);

	// Must not re-introduce removed legacy quirks or duplicate namespaces
	assert.doesNotMatch(css, /\bmain\s*\{[\s\S]*?min-height:/);
	assert.doesNotMatch(css, /\.smooth\s*\{/);
	assert.doesNotMatch(css, /--color-primary:/);
	assert.doesNotMatch(css, /--color-light:/);
	assert.doesNotMatch(css, /--color-action:/);
	assert.doesNotMatch(css, /--color-error:/);
	assert.doesNotMatch(css, /--color-muted-foreground:/);
	assert.doesNotMatch(css, /(--[a-z0-9-]+):\s*var\(\1\)/);
});

test("production src files contain zero legacy tokens, broken CSS variables, or forbidden blue hex", () => {
	const forbiddenTokenClasses =
		/(?<![a-zA-Z0-9-])(?:bg|text|border|ring|divide|from|to|via|fill|stroke|caret|outline|placeholder)-(?:primary|secondary|tertiary|light|default|action|action-foreground|error|info|focus|faint|inverse|elevated|glass|border-light|border-dark|card-foreground|accent-foreground|muted-foreground|brand-secondary|brand-tertiary|popover|popover-foreground|chart-queries|chart-results)(?:\/\d+)?(?![a-zA-Z0-9-])/;

	const forbiddenCssVars =
		/var\(--(?:color-primary|color-secondary|color-tertiary|color-light|color-default|color-action|color-error|color-info|color-success|color-muted-foreground|muted-foreground|brand-dark)\)/;

	const forbiddenBlue = /#2563eb|\b(?:bg|text|border|ring)-blue-(?:600|700)\b/i;

	const violations: string[] = [];

	for (const filePath of walkSourceFiles(SRC_ROOT)) {
		const rel = path.relative(process.cwd(), filePath);
		const content = fs.readFileSync(filePath, "utf8");

		const tokenMatch = content.match(forbiddenTokenClasses);
		if (tokenMatch) {
			violations.push(`${rel}: legacy token class "${tokenMatch[0]}"`);
		}

		const varMatch = content.match(forbiddenCssVars);
		if (varMatch) {
			violations.push(`${rel}: removed CSS variable "${varMatch[0]}"`);
		}

		const blueMatch = content.match(forbiddenBlue);
		if (blueMatch) {
			violations.push(`${rel}: forbidden blue color "${blueMatch[0]}"`);
		}
	}

	assert.deepEqual(violations, []);
});

test("visual effects are separated from core UI primitives", () => {
	const uiFiles = fs.readdirSync(path.join(SRC_ROOT, "components/ui"));
	const effectFiles = fs.readdirSync(path.join(SRC_ROOT, "components/effects"));

	assert.ok(uiFiles.includes("Button.tsx"));
	assert.ok(uiFiles.includes("Card.tsx"));
	assert.ok(uiFiles.includes("Avatar.tsx"));
	assert.ok(!uiFiles.includes("macbook-scroll.tsx"));
	assert.ok(!uiFiles.includes("spotlight.tsx"));

	assert.ok(effectFiles.includes("macbook-scroll.tsx"));
	assert.ok(effectFiles.includes("spotlight.tsx"));
	assert.ok(effectFiles.includes("wobble-card.tsx"));
	assert.ok(effectFiles.includes("hero-section.tsx"));
});
