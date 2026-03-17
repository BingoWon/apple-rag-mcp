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

/**
 * Modern MCP Configuration Service
 * Single source of truth for all MCP configurations
 */
export class MCPConfigService {
	private static readonly DEFAULT_SERVER_URL = "https://mcp.apple-rag.com";
	private static readonly SERVER_NAME = "apple-rag-mcp";

	/**
	 * Generate MCP server configuration for specific client
	 */
	static generateServerConfig(options: MCPConfigOptions): MCPServerConfig {
		const {
			token,
			serverUrl = MCPConfigService.DEFAULT_SERVER_URL,
			clientType = "generic",
		} = options;

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
	 * Generate complete MCP configuration object
	 */
	static generateConfig(options: MCPConfigOptions) {
		return {
			mcpServers: {
				[MCPConfigService.SERVER_NAME]: MCPConfigService.generateServerConfig(options),
			},
		};
	}

	/**
	 * Generate formatted JSON configuration string
	 */
	static generateJsonString(options: MCPConfigOptions): string {
		const jsonString = JSON.stringify(MCPConfigService.generateConfig(options), null, 2);

		// Show IP authentication tip for Augment Code
		if (options.clientType === "augmentcode") {
			// Import toast and React dynamically to avoid SSR issues
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

		return jsonString;
	}

	/**
	 * Generate TOML configuration string for Codex CLI
	 */
	static generateTomlString(token: string): string {
		return [
			"[mcp_servers.apple-rag-mcp]",
			'url = "https://mcp.apple-rag.com"',
			`bearer_token_env_var = "${token}"`,
		].join("\n");
	}

	/**
	 * Generate Claude Code add command
	 */
	static generateClaudeCodeCommand(token: string, serverUrl?: string): string {
		const url = serverUrl || MCPConfigService.DEFAULT_SERVER_URL;
		return `claude mcp add --transport http --header "Authorization: Bearer ${token}" ${MCPConfigService.SERVER_NAME} ${url}`;
	}

	/**
	 * Generate Cursor deeplink URL
	 */
	static generateCursorLink(token: string): string {
		const config = MCPConfigService.generateServerConfig({ token });
		const jsonConfig = JSON.stringify(config);
		const base64Config = btoa(jsonConfig);

		return `https://cursor.com/en/install-mcp?name=${encodeURIComponent(
			MCPConfigService.SERVER_NAME,
		)}&config=${encodeURIComponent(base64Config)}`;
	}

	/**
	 * Copy configuration to clipboard
	 */
	static async copyToClipboard(
		options: MCPConfigOptions,
		onSuccess?: (message: string) => void,
		onError?: (message: string) => void,
	): Promise<void> {
		try {
			const configJson = MCPConfigService.generateJsonString(options);
			await navigator.clipboard.writeText(configJson);
			onSuccess?.("MCP configuration copied to clipboard!");
		} catch (error) {
			console.error("Failed to copy to clipboard:", error);
			onError?.("Failed to copy configuration to clipboard");
		}
	}

	/**
	 * Open Cursor install link
	 */
	static openCursorLink(token: string): void {
		const link = MCPConfigService.generateCursorLink(token);
		window.open(link, "_blank");
	}

	/**
	 * Generate VS Code install URL with MCP configuration
	 */
	static generateVSCodeInstallUrl(token: string, serverUrl?: string): string {
		const config = {
			name: MCPConfigService.SERVER_NAME,
			...MCPConfigService.generateServerConfig({ token, serverUrl }),
		};
		return `vscode:mcp/install?${encodeURIComponent(JSON.stringify(config))}`;
	}

	/**
	 * Generate VS Code Insiders install URL
	 */
	static generateVSCodeInsidersInstallUrl(token: string, serverUrl?: string): string {
		const config = {
			name: MCPConfigService.SERVER_NAME,
			...MCPConfigService.generateServerConfig({ token, serverUrl }),
		};
		return `vscode-insiders:mcp/install?${encodeURIComponent(JSON.stringify(config))}`;
	}

	/**
	 * Generate Shields.io badge URL for VS Code
	 */
	static generateVSCodeBadgeUrl(
		text: string = "Install Apple RAG MCP",
		color: string = "0098FF",
	): string {
		const encodedText = text.replace(/ /g, "_").replace(/-/g, "--");
		return `https://img.shields.io/badge/VS_Code-${encodeURIComponent(encodedText)}-${color}?style=flat&logo=visualstudiocode&logoColor=ffffff`;
	}

	/**
	 * Generate Shields.io badge URL for VS Code Insiders
	 */
	static generateVSCodeInsidersBadgeUrl(
		text: string = "Install Apple RAG MCP",
		color: string = "24bfa5",
	): string {
		const encodedText = text.replace(/ /g, "_").replace(/-/g, "--");
		return `https://img.shields.io/badge/VS_Code_Insiders-${encodeURIComponent(encodedText)}-${color}?style=flat&logo=visualstudiocode&logoColor=ffffff`;
	}
}
