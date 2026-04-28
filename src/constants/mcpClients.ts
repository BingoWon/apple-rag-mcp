/**
 * Shared MCP Client Registry
 *
 * Single source of truth for all MCP client configurations.
 * Used by MCPInstallButtons (Overview page) and MCPTokensList (Tokens page dropdown).
 */
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
		logo: "https://cursor.com/_next/static/media/placeholder-logo.da8a9d2b.webp",
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
		logo: "https://api.iconify.design/vscode-icons:file-type-vscode.svg",
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
		logo: "https://api.iconify.design/vscode-icons:file-type-vscode-insiders.svg",
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
		key: "claudecode",
		logo: "https://api.iconify.design/logos:claude-icon.svg",
		alt: "Claude Code",
		label: "Claude Code",
		category: "copy",
		action: async (token, serverUrl) => {
			const command = MCPConfigService.generateClaudeCodeCommand(token, serverUrl);
			await navigator.clipboard.writeText(command);
			return "tokens.config_copied";
		},
	},
	{
		key: "codex",
		logo: "https://api.iconify.design/logos:openai-icon.svg",
		alt: "OpenAI Codex",
		label: "Codex",
		category: "copy",
		action: async (token, serverUrl) => {
			const command = MCPConfigService.generateCodexCommand(token, serverUrl);
			await navigator.clipboard.writeText(command);
			return "tokens.config_copied";
		},
	},
	{
		key: "antigravity",
		logo: "https://antigravity.google/favicon.ico",
		alt: "Antigravity",
		label: "Antigravity",
		category: "copy",
		action: async (token, serverUrl) => {
			const json = MCPConfigService.generateAntigravityJsonString(token, serverUrl);
			await navigator.clipboard.writeText(json);
			return "tokens.config_copied";
		},
	},
	{
		key: "augmentcode",
		logo: "https://www.augmentcode.com/favicon.ico",
		alt: "Augment Code",
		label: "Augment Code",
		category: "copy",
		action: async (token, serverUrl) => {
			const json = MCPConfigService.generateJsonString({
				token,
				serverUrl,
				clientType: "augmentcode",
			});
			await navigator.clipboard.writeText(json);
			MCPConfigService.showAugmentCodeWarning();
			return "tokens.config_copied";
		},
	},
	{
		key: "cline",
		logo: "https://cline.bot/assets/branding/favicons/favicon-32x32.png",
		alt: "Cline",
		label: "Cline",
		category: "copy",
		action: async (token, serverUrl) => {
			const json = MCPConfigService.generateJsonString({
				token,
				serverUrl,
				clientType: "cline",
			});
			await navigator.clipboard.writeText(json);
			return "tokens.config_copied";
		},
	},
	{
		key: "roocode",
		logo: "https://roocode.com/favicon.ico",
		alt: "Roo Code",
		label: "Roo Code",
		category: "copy",
		action: async (token, serverUrl) => {
			const json = MCPConfigService.generateJsonString({
				token,
				serverUrl,
				clientType: "roocode",
			});
			await navigator.clipboard.writeText(json);
			return "tokens.config_copied";
		},
	},
];

/** Clients that offer a one-click install flow */
export const INSTALL_CLIENTS = MCP_CLIENTS.filter((c) => c.category === "install");

/** Clients that copy configuration to clipboard */
export const COPY_CLIENTS = MCP_CLIENTS.filter((c) => c.category === "copy");
