import assert from "node:assert/strict";
import test from "node:test";
import { generateCodexTomlString, generateJsonString } from "./mcpConfigService.js";

const TOKEN = `at_${"a".repeat(32)}`;

test("generates raw JSON without Markdown links or escaped underscores", () => {
	const json = generateJsonString({ token: TOKEN });
	const parsed = JSON.parse(json);

	assert.equal(parsed.mcpServers["apple-rag-mcp"].url, "https://mcp.apple-rag.com");
	assert.equal(parsed.mcpServers["apple-rag-mcp"].headers.Authorization, `Bearer ${TOKEN}`);
	assert.doesNotMatch(json, /\[https?:\/\//);
	assert.doesNotMatch(json, /\\_/);
});

test("generates raw Codex TOML values", () => {
	const toml = generateCodexTomlString(TOKEN);

	assert.match(toml, /url = "https:\/\/mcp\.apple-rag\.com"/);
	assert.match(toml, new RegExp(`Authorization = "Bearer ${TOKEN}"`));
	assert.doesNotMatch(toml, /\\_/);
});
