import { MCP_SERVER_NAME, MCP_SERVER_URL } from "@/constants/mcp";
import { copyText } from "@/utils/clipboard";

export type MCPClientType =
	| "cursor"
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
	autoApprove?: string[];
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

function shellArgument(value: string): string {
	return `'${value.replace(/'/g, "'\\''")}'`;
}

export function generateServerConfig(options: MCPConfigOptions): MCPServerConfig {
	const { token, serverUrl = MCP_SERVER_URL, clientType = "generic" } = options;

	switch (clientType) {
		case "cline":
			return {
				type: "streamableHttp",
				url: serverUrl,
				headers: { Authorization: `Bearer ${token}` },
				autoApprove: ["search", "fetch"],
				disabled: false,
			};
		case "cursor":
			return {
				url: serverUrl,
				headers: { Authorization: `Bearer ${token}` },
			};
		default:
			return {
				type: "http",
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
	return `claude mcp add --transport http --scope user ${MCP_SERVER_NAME} ${shellArgument(url)} --header ${shellArgument(`Authorization: Bearer ${token}`)}`;
}

export function generateCursorLink(token: string, serverUrl?: string): string {
	const config = generateServerConfig({ token, serverUrl, clientType: "cursor" });
	const jsonConfig = JSON.stringify(config);
	const base64Config = btoa(String.fromCharCode(...new TextEncoder().encode(jsonConfig)));

	return `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(
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
		await copyText(configJson);
		onSuccess?.("MCP configuration copied to clipboard!");
	} catch (error) {
		console.error("Failed to copy to clipboard:", error);
		onError?.("Failed to copy configuration to clipboard");
	}
}

export function generateVSCodeInstallUrl(token: string, serverUrl?: string): string {
	const config = {
		name: MCP_SERVER_NAME,
		...generateServerConfig({ token, serverUrl, clientType: "vscode" }),
	};
	return `vscode:mcp/install?${encodeURIComponent(JSON.stringify(config))}`;
}

export function generateVSCodeInsidersInstallUrl(token: string, serverUrl?: string): string {
	const config = {
		name: MCP_SERVER_NAME,
		...generateServerConfig({ token, serverUrl, clientType: "vscode-insiders" }),
	};
	return `vscode-insiders:mcp/install?${encodeURIComponent(JSON.stringify(config))}`;
}

export const MCPConfigService = {
	generateServerConfig,
	generateConfig,
	generateJsonString,
	generateCodexTomlString,
	generateClaudeCodeCommand,
	generateCursorLink,
	copyToClipboard,
	generateVSCodeInstallUrl,
	generateVSCodeInsidersInstallUrl,
	generateAntigravityConfig,
	generateAntigravityJsonString,
};
