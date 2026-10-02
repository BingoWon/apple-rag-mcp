/**
 * Shared MCP Client Registry
 *
 * Single source of truth for all MCP client configurations.
 * Used by MCPInstallButtons (Overview page) and MCPTokensList (Tokens page dropdown).
 */

import { showAugmentCodeWarning } from "@/utils/augmentCodeWarning";
import { copyText } from "@/utils/clipboard";
import { MCPConfigService } from "@/utils/mcpConfigService";

export interface MCPClientConfig {
	key: string;
	logo: string;
	alt: string;
	label: string;
	/** 'install' opens an external flow, 'copy' copies config to clipboard */
	category: "install" | "copy";
	/** Given a token and serverUrl, perform the client-specific action and return a success message */
	action: (token: string, serverUrl: string) => Promise<string>;
}

/**
 * All supported MCP clients, keyed by a stable identifier.
 * Order within each category determines display order.
 */
export const MCP_CLIENTS: MCPClientConfig[] = [
	// --- One-click Install ---
	{
		key: "cursor",
		logo: "/mcp-clients/cursor.png",
		alt: "Cursor",
		label: "Cursor",
		category: "install",
		action: async (token) => {
			const url = MCPConfigService.generateCursorLink(token);
			window.open(url, "_blank");
			return "tokens.install_hint";
		},
	},
	{
		key: "vscode",
		logo: "/mcp-clients/vscode.svg",
		alt: "VS Code",
		label: "VS Code",
		category: "install",
		action: async (token, serverUrl) => {
			const url = MCPConfigService.generateVSCodeInstallUrl(token, serverUrl);
			window.open(url, "_blank");
			return "tokens.install_hint";
		},
	},
	{
		key: "vscode-insiders",
		logo: "/mcp-clients/vscode-insiders.svg",
		alt: "VS Code Insiders",
		label: "VS Code Insiders",
		category: "install",
		action: async (token, serverUrl) => {
			const url = MCPConfigService.generateVSCodeInsidersInstallUrl(token, serverUrl);
			window.open(url, "_blank");
			return "tokens.install_hint";
		},
	},

	// --- Copy Configuration ---
	{
		key: "codex",
		logo: "/mcp-clients/codex.svg",
		alt: "OpenAI Codex",
		label: "Codex",
		category: "copy",
		action: async (token, serverUrl) => {
			const toml = MCPConfigService.generateCodexTomlString(token, serverUrl);
			await copyText(toml);
			return "tokens.config_copied";
		},
	},
	{
		key: "claudecode",
		logo: "/mcp-clients/claude.svg",
		alt: "Claude Code",
		label: "Claude Code",
		category: "copy",
		action: async (token, serverUrl) => {
			const command = MCPConfigService.generateClaudeCodeCommand(token, serverUrl);
			await copyText(command);
			return "tokens.config_copied";
		},
	},
	{
		key: "antigravity",
		logo: "/mcp-clients/antigravity.png",
		alt: "Antigravity",
		label: "Antigravity",
		category: "copy",
		action: async (token, serverUrl) => {
			const json = MCPConfigService.generateAntigravityJsonString(token, serverUrl);
			await copyText(json);
			return "tokens.config_copied";
		},
	},
	{
		key: "augmentcode",
		logo: "/mcp-clients/augmentcode.png",
		alt: "Augment Code",
		label: "Augment Code",
		category: "copy",
		action: async (token, serverUrl) => {
			const json = MCPConfigService.generateJsonString({
				token,
				serverUrl,
				clientType: "augmentcode",
			});
			await copyText(json);
			showAugmentCodeWarning();
			return "tokens.config_copied";
		},
	},
	{
		key: "cline",
		logo: "/mcp-clients/cline.png",
		alt: "Cline",
		label: "Cline",
		category: "copy",
		action: async (token, serverUrl) => {
			const json = MCPConfigService.generateJsonString({
				token,
				serverUrl,
				clientType: "cline",
			});
			await copyText(json);
			return "tokens.config_copied";
		},
	},
];

/** Clients that offer a one-click install flow */
export const INSTALL_CLIENTS = MCP_CLIENTS.filter((c) => c.category === "install");

/** Clients that copy configuration to clipboard */
export const COPY_CLIENTS = MCP_CLIENTS.filter((c) => c.category === "copy");
