import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import test from "node:test";
import { INSTALL_CLIENTS, PROMPT_CLIENTS } from "../constants/mcpClients.js";
import {
	generateClaudeCodeCommand,
	generateCodexTomlString,
	generateCursorLink,
	generateInstallPrompt,
	generateJsonString,
	generateVSCodeInsidersInstallUrl,
	generateVSCodeInstallUrl,
} from "./mcpConfigService.js";

const TOKEN = `at_${"a".repeat(32)}`;
const SERVER_URL = "https://mcp.apple-rag.com";
const CUSTOM_URL = "https://example.com/mcp?label=苹果&scope=read";

test("generates raw JSON without Markdown links or escaped underscores", () => {
	const json = generateJsonString({ token: TOKEN });
	const parsed = JSON.parse(json);

	assert.equal(parsed.mcpServers["apple-rag-mcp"].type, "http");
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

test("encodes the Cursor install URI with the selected URL and UTF-8 JSON", () => {
	const link = new URL(generateCursorLink(TOKEN, CUSTOM_URL));
	assert.equal(link.protocol, "cursor:");
	assert.equal(link.hostname, "anysphere.cursor-deeplink");
	assert.equal(link.pathname, "/mcp/install");
	assert.equal(link.searchParams.get("name"), "apple-rag-mcp");

	const config = JSON.parse(Buffer.from(link.searchParams.get("config")!, "base64").toString());
	assert.deepEqual(config, {
		url: CUSTOM_URL,
		headers: { Authorization: `Bearer ${TOKEN}` },
	});
});

test("generates explicit HTTP install payloads for both VS Code editions", () => {
	for (const [generate, protocol] of [
		[generateVSCodeInstallUrl, "vscode:"],
		[generateVSCodeInsidersInstallUrl, "vscode-insiders:"],
	] as const) {
		const link = new URL(generate(TOKEN, CUSTOM_URL));
		assert.equal(link.protocol, protocol);
		assert.equal(link.pathname, "mcp/install");
		assert.deepEqual(JSON.parse(decodeURIComponent(link.search.slice(1))), {
			name: "apple-rag-mcp",
			type: "http",
			url: CUSTOM_URL,
			headers: { Authorization: `Bearer ${TOKEN}` },
		});
	}
});

test("keeps Codex URL and bearer header in the official TOML tables", () => {
	assert.equal(
		generateCodexTomlString(TOKEN, CUSTOM_URL),
		`[mcp_servers.apple-rag-mcp]
url = "${CUSTOM_URL}"

[mcp_servers.apple-rag-mcp.http_headers]
Authorization = "Bearer ${TOKEN}"`,
	);
	assert.match(generateCodexTomlString('quote"\\\n\r\t'), /Bearer quote\\"\\\\\\n\\r\\t/);
});

test("keeps Claude Code HTTP/user scope and quotes each dynamic argument", () => {
	for (const url of [SERVER_URL, `${CUSTOM_URL}&text=it's $(echo wrong); echo wrong`]) {
		const token = `${TOKEN}'"$example`;
		const command = generateClaudeCodeCommand(token, url);
		// Parse with a real shell without launching Claude or changing its configuration.
		const args = execFileSync("/bin/sh", ["-c", `set -- ${command}; printf '%s\\0' "$@"`])
			.toString()
			.split("\0")
			.slice(0, -1);
		assert.deepEqual(args, [
			"claude",
			"mcp",
			"add",
			"--transport",
			"http",
			"--scope",
			"user",
			"apple-rag-mcp",
			url,
			"--header",
			`Authorization: Bearer ${token}`,
		]);
	}
});

test("generates a localized agent prompt with literal URL and token", () => {
	for (const language of ["en", "zh", "zh-CN", "fr"]) {
		const prompt = generateInstallPrompt({ token: TOKEN, serverUrl: CUSTOM_URL }, language);
		assert.ok(prompt.includes(CUSTOM_URL));
		assert.ok(prompt.includes(`Authorization: Bearer ${TOKEN}`));
		assert.match(prompt, /search.*fetch/);
		assert.match(prompt, /manifest/);
		assert.doesNotMatch(prompt, /\[https?:\/\//);
		assert.doesNotMatch(prompt, /\\_/);
		assert.doesNotMatch(prompt, /mcpServers|\[mcp_servers|claude mcp add/);
		if (language.startsWith("zh")) {
			assert.match(prompt, /个人用户范围/);
			assert.match(prompt, /保留其他已有配置/);
			assert.match(prompt, /不要仅凭配置已写入就报告成功/);
			assert.match(prompt, /不要输出完整 Token/);
		} else {
			assert.match(prompt, /user-level configuration/);
			assert.match(prompt, /preserve other existing settings/);
			assert.match(prompt, /Do not report success based only on writing configuration/);
			assert.match(prompt, /do not print the full token/);
		}
	}
	assert.ok(generateInstallPrompt({ token: TOKEN }).includes(SERVER_URL));
});

test("regenerates the install prompt for the selected token", () => {
	const replacementToken = `at_${"b".repeat(32)}`;
	const prompt = generateInstallPrompt({ token: replacementToken }, "zh");
	assert.ok(prompt.includes(replacementToken));
	assert.ok(!prompt.includes(TOKEN));
});

test("every displayed client logo is a local, existing asset", () => {
	for (const client of [...INSTALL_CLIENTS, ...PROMPT_CLIENTS]) {
		assert.ok(client.logo.startsWith("/mcp-clients/"), client.label);
		assert.ok(existsSync(new URL(`../../public${client.logo}`, import.meta.url)), client.label);
	}
});

test("all native install buttons use the selected server URL and token", async () => {
	const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
	let opened = "";

	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: {
			open: (url: string, target: string) => {
				assert.equal(target, "_blank");
				opened = url;
			},
		},
	});
	try {
		assert.deepEqual(
			INSTALL_CLIENTS.map((client) => client.key),
			["cursor", "vscode", "vscode-insiders"],
		);
		for (const client of INSTALL_CLIENTS) {
			opened = "";
			const result = await client.action(TOKEN, CUSTOM_URL);
			assert.equal(result, "tokens.install_hint");
			const link = new URL(opened);
			const json =
				client.key === "cursor"
					? Buffer.from(link.searchParams.get("config")!, "base64").toString()
					: decodeURIComponent(link.search.slice(1));
			const config = JSON.parse(json);
			assert.equal(config.url, CUSTOM_URL, client.key);
			assert.equal(config.headers.Authorization, `Bearer ${TOKEN}`, client.key);
		}
	} finally {
		if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
		else Reflect.deleteProperty(globalThis, "window");
	}
});
