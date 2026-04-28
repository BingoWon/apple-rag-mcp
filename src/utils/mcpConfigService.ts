/**
 * Modern MCP Configuration Service
 * Unified, type-safe MCP configuration generation for all clients
 */

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

const DEFAULT_SERVER_URL = "https://mcp.apple-rag.com";
const SERVER_NAME = "apple-rag-mcp";
const CODEX_TOKEN_ENV_VAR = "APPLE_RAG_MCP_TOKEN";

function shellQuote(value: string): string {
	return `'${value.replace(/'/g, "'\\''")}'`;
}

export function generateServerConfig(options: MCPConfigOptions): MCPServerConfig {
	const { token, serverUrl = DEFAULT_SERVER_URL, clientType = "generic" } = options;

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
	const url = serverUrl || DEFAULT_SERVER_URL;
	return {
		mcpServers: {
			[SERVER_NAME]: {
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
			[SERVER_NAME]: generateServerConfig(options),
		},
	};
}

export function generateJsonString(options: MCPConfigOptions): string {
	return JSON.stringify(generateConfig(options), null, 2);
}

export function showAugmentCodeWarning(): void {
	Promise.all([import("react-hot-toast"), import("react"), import("@tabler/icons-react")]).then(
		([{ default: toast }, React, { IconAlertTriangle }]) => {
			const handleClick = () => {
				window.open("/authorized-ips", "_blank");
			};

			toast.custom(
				() =>
					React.createElement(
						"div",
						{
							onClick: handleClick,
							style: {
								background: "var(--color-warning)",
								color: "var(--color-inverse)",
								border: "2px solid var(--color-warning)",
								borderRadius: "12px",
								fontSize: "15px",
								fontWeight: "600",
								boxShadow: "0 8px 25px rgba(251, 191, 36, 0.3)",
								padding: "10px 14px",
								cursor: "pointer",
								display: "flex",
								alignItems: "center",
								gap: "12px",
								userSelect: "none",
								maxWidth: "470px",
							},
						},
						React.createElement(IconAlertTriangle, {
							size: 20,
							style: { flexShrink: 0 },
						}),
						React.createElement(
							"span",
							null,
							"Augment Code doesn't support Authorization headers. Click to configure Authorized IP Addresses!",
						),
					),
				{
					duration: 12000,
				},
			);
		},
	);
}

export function generateCodexCommand(
	token: string,
	serverUrl: string = DEFAULT_SERVER_URL,
): string {
	return [
		`export ${CODEX_TOKEN_ENV_VAR}=${shellQuote(token)}`,
		`codex mcp add ${SERVER_NAME} --url ${shellQuote(serverUrl)} --bearer-token-env-var ${CODEX_TOKEN_ENV_VAR}`,
	].join("\n");
}

export function generateClaudeCodeCommand(token: string, serverUrl?: string): string {
	const url = serverUrl || DEFAULT_SERVER_URL;
	return `claude mcp add --transport http --scope user ${SERVER_NAME} ${url} --header "Authorization: Bearer ${token}"`;
}

export function generateCursorLink(token: string): string {
	const config = generateServerConfig({ token });
	const jsonConfig = JSON.stringify(config);
	const base64Config = btoa(jsonConfig);

	return `https://cursor.com/en/install-mcp?name=${encodeURIComponent(
		SERVER_NAME,
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
		name: SERVER_NAME,
		...generateServerConfig({ token, serverUrl }),
	};
	return `vscode:mcp/install?${encodeURIComponent(JSON.stringify(config))}`;
}

export function generateVSCodeInsidersInstallUrl(token: string, serverUrl?: string): string {
	const config = {
		name: SERVER_NAME,
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
	showAugmentCodeWarning,
	generateCodexCommand,
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
