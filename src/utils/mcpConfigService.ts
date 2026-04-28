import { MCP_SERVER_NAME, MCP_SERVER_URL } from "@/constants/mcp";

export type MCPClientType =
	| "cursor"
	| "roocode"
	| "augmentcode"
	| "cline"
	| "vscode"
	| "vscode-insiders"
	| "codex"
	| "claudecode"
	| "generic";

export interface MCPServerConfig {
	url: string;
	headers: Record<string, string>;
	type?: string;
	alwaysAllow?: string[];
	disabled?: boolean;
}

export interface MCPConfigOptions {
	token: string;
	serverUrl?: string;
	clientType?: MCPClientType;
}

function tomlString(value: string): string {
	return `"${value
		.replace(/\\/g, "\\\\")
		.replace(/"/g, '\\"')
		.replace(/\n/g, "\\n")
		.replace(/\r/g, "\\r")
		.replace(/\t/g, "\\t")}"`;
}

export function generateServerConfig(options: MCPConfigOptions): MCPServerConfig {
	const { token, serverUrl = MCP_SERVER_URL, clientType = "generic" } = options;

	switch (clientType) {
		case "augmentcode":
			return {
				url: serverUrl,
				type: "http",
				headers: { Authorization: `Bearer ${token}` },
			};
		case "roocode":
		case "cline":
			return {
				type: "streamable-http",
				url: serverUrl,
				headers: { Authorization: `Bearer ${token}` },
				alwaysAllow: ["search", "fetch"],
				disabled: false,
			};
		default:
			return {
				url: serverUrl,
				headers: { Authorization: `Bearer ${token}` },
			};
	}
}

/**
 * Generate Antigravity-specific MCP config.
 * Antigravity uses `serverUrl` instead of `url` and includes Content-Type header.
 */
export function generateAntigravityConfig(token: string, serverUrl?: string) {
	const url = serverUrl || MCP_SERVER_URL;
	return {
		mcpServers: {
			[MCP_SERVER_NAME]: {
				serverUrl: url,
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
			},
		},
	};
}

export function generateAntigravityJsonString(token: string, serverUrl?: string): string {
	return JSON.stringify(generateAntigravityConfig(token, serverUrl), null, 2);
}

export function generateConfig(options: MCPConfigOptions) {
	return {
		mcpServers: {
			[MCP_SERVER_NAME]: generateServerConfig(options),
		},
	};
}

export function generateJsonString(options: MCPConfigOptions): string {
	return JSON.stringify(generateConfig(options), null, 2);
}

export function generateCodexTomlString(token: string, serverUrl: string = MCP_SERVER_URL): string {
	return [
		`[mcp_servers.${MCP_SERVER_NAME}]`,
		`url = ${tomlString(serverUrl)}`,
		"",
		`[mcp_servers.${MCP_SERVER_NAME}.http_headers]`,
		`Authorization = ${tomlString(`Bearer ${token}`)}`,
	].join("\n");
}

export function generateClaudeCodeCommand(token: string, serverUrl?: string): string {
	const url = serverUrl || MCP_SERVER_URL;
	return `claude mcp add --transport http --scope user ${MCP_SERVER_NAME} ${url} --header "Authorization: Bearer ${token}"`;
}

export function generateCursorLink(token: string): string {
	const config = generateServerConfig({ token });
	const jsonConfig = JSON.stringify(config);
	const base64Config = btoa(jsonConfig);

	return `https://cursor.com/en/install-mcp?name=${encodeURIComponent(
		MCP_SERVER_NAME,
	)}&config=${encodeURIComponent(base64Config)}`;
}

export async function copyToClipboard(
	options: MCPConfigOptions,
	onSuccess?: (message: string) => void,
	onError?: (message: string) => void,
): Promise<void> {
	try {
		const configJson = generateJsonString(options);
		await navigator.clipboard.writeText(configJson);
		onSuccess?.("MCP configuration copied to clipboard!");
	} catch (error) {
		console.error("Failed to copy to clipboard:", error);
		onError?.("Failed to copy configuration to clipboard");
	}
}

export function openCursorLink(token: string): void {
	const link = generateCursorLink(token);
	window.open(link, "_blank");
}

export function generateVSCodeInstallUrl(token: string, serverUrl?: string): string {
	const config = {
		name: MCP_SERVER_NAME,
		...generateServerConfig({ token, serverUrl }),
	};
	return `vscode:mcp/install?${encodeURIComponent(JSON.stringify(config))}`;
}

export function generateVSCodeInsidersInstallUrl(token: string, serverUrl?: string): string {
	const config = {
		name: MCP_SERVER_NAME,
		...generateServerConfig({ token, serverUrl }),
	};
	return `vscode-insiders:mcp/install?${encodeURIComponent(JSON.stringify(config))}`;
}

export function generateVSCodeBadgeUrl(
	text: string = "Install Apple RAG MCP",
	color: string = "0098FF",
): string {
	const encodedText = text.replace(/ /g, "_").replace(/-/g, "--");
	return `https://img.shields.io/badge/VS_Code-${encodeURIComponent(encodedText)}-${color}?style=flat&logo=visualstudiocode&logoColor=ffffff`;
}

export function generateVSCodeInsidersBadgeUrl(
	text: string = "Install Apple RAG MCP",
	color: string = "24bfa5",
): string {
	const encodedText = text.replace(/ /g, "_").replace(/-/g, "--");
	return `https://img.shields.io/badge/VS_Code_Insiders-${encodeURIComponent(encodedText)}-${color}?style=flat&logo=visualstudiocode&logoColor=ffffff`;
}

export const MCPConfigService = {
	generateServerConfig,
	generateConfig,
	generateJsonString,
	generateCodexTomlString,
	generateClaudeCodeCommand,
	generateCursorLink,
	copyToClipboard,
	openCursorLink,
	generateVSCodeInstallUrl,
	generateVSCodeInsidersInstallUrl,
	generateVSCodeBadgeUrl,
	generateVSCodeInsidersBadgeUrl,
	generateAntigravityConfig,
	generateAntigravityJsonString,
};
