import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { MCP_CLIENTS } from "../constants/mcpClients.js";
import {
	generateAntigravityJsonString,
	generateClaudeCodeCommand,
	generateCodexTomlString,
	generateCursorLink,
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

test("keeps Cursor's native copied configuration without other clients' transport fields", () => {
	const config = JSON.parse(generateJsonString({ token: TOKEN, clientType: "cursor" }));
	assert.deepEqual(config.mcpServers["apple-rag-mcp"], {
		url: SERVER_URL,
		headers: { Authorization: `Bearer ${TOKEN}` },
	});
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

test("generates Cline's current transport and tool approval fields", () => {
	const config = JSON.parse(generateJsonString({ token: TOKEN, clientType: "cline" }));
	assert.deepEqual(config.mcpServers["apple-rag-mcp"], {
		type: "streamableHttp",
		url: SERVER_URL,
		headers: { Authorization: `Bearer ${TOKEN}` },
		autoApprove: ["search", "fetch"],
		disabled: false,
	});
});

test("keeps bearer authentication in Augment and Antigravity configurations", () => {
	const augment = JSON.parse(
		generateJsonString({ token: TOKEN, serverUrl: CUSTOM_URL, clientType: "augmentcode" }),
	);
	assert.deepEqual(augment.mcpServers["apple-rag-mcp"], {
		type: "http",
		url: CUSTOM_URL,
		headers: { Authorization: `Bearer ${TOKEN}` },
	});

	const antigravity = JSON.parse(generateAntigravityJsonString(TOKEN, CUSTOM_URL));
	assert.deepEqual(antigravity.mcpServers["apple-rag-mcp"], {
		serverUrl: CUSTOM_URL,
		headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
	});
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

test("all dashboard install and copy buttons use the selected server URL and token", async () => {
	const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
	const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
	let opened = "";
	let copied = "";

	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: {
			open: (url: string, target: string) => {
				assert.equal(target, "_blank");
				opened = url;
			},
		},
	});
	Object.defineProperty(globalThis, "navigator", {
		configurable: true,
		value: {
			clipboard: {
				writeText: async (value: string) => {
					copied = value;
				},
			},
		},
	});

	try {
		assert.deepEqual(
			MCP_CLIENTS.map((client) => client.key),
			[
				"cursor",
				"vscode",
				"vscode-insiders",
				"codex",
				"claudecode",
				"antigravity",
				"augmentcode",
				"cline",
			],
		);
		for (const client of MCP_CLIENTS) {
			opened = "";
			copied = "";
			const result = await client.action(TOKEN, CUSTOM_URL);
			assert.equal(
				result,
				client.category === "install" ? "tokens.install_hint" : "tokens.config_copied",
			);

			if (client.category === "install") {
				const link = new URL(opened);
				const json =
					client.key === "cursor"
						? Buffer.from(link.searchParams.get("config")!, "base64").toString()
						: decodeURIComponent(link.search.slice(1));
				const config = JSON.parse(json);
				assert.equal(config.url, CUSTOM_URL, client.key);
				assert.equal(config.headers.Authorization, `Bearer ${TOKEN}`, client.key);
			} else if (client.key === "codex") {
				assert.equal(copied, generateCodexTomlString(TOKEN, CUSTOM_URL));
			} else if (client.key === "claudecode") {
				assert.equal(copied, generateClaudeCodeCommand(TOKEN, CUSTOM_URL));
			} else {
				const config = JSON.parse(copied).mcpServers["apple-rag-mcp"];
				assert.equal(config.url ?? config.serverUrl, CUSTOM_URL, client.key);
				assert.equal(config.headers.Authorization, `Bearer ${TOKEN}`, client.key);
			}
		}
	} finally {
		for (const [key, descriptor] of [
			["window", originalWindow],
			["navigator", originalNavigator],
		] as const) {
			if (descriptor) Object.defineProperty(globalThis, key, descriptor);
			else Reflect.deleteProperty(globalThis, key);
		}
	}
});
