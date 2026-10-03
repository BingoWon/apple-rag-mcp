/**
 * Native install links shared by the dashboard and token menu.
 */

import { MCPConfigService } from "@/utils/mcpConfigService";

export interface MCPInstallClient {
	key: string;
	logo: string;
	alt: string;
	label: string;
	/** Given a token and serverUrl, perform the client-specific action and return a success message */
	action: (token: string, serverUrl: string) => Promise<string>;
}

/**
 * Only clients with an official install deep link belong here.
 */
export const INSTALL_CLIENTS: MCPInstallClient[] = [
	{
		key: "cursor",
		logo: "/mcp-clients/cursor.png",
		alt: "Cursor",
		label: "Cursor",
		action: async (token, serverUrl) => {
			const url = MCPConfigService.generateCursorLink(token, serverUrl);
			window.open(url, "_blank");
			return "tokens.install_hint";
		},
	},
	{
		key: "vscode",
		logo: "/mcp-clients/vscode.svg",
		alt: "VS Code",
		label: "VS Code",
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
		action: async (token, serverUrl) => {
			const url = MCPConfigService.generateVSCodeInsidersInstallUrl(token, serverUrl);
			window.open(url, "_blank");
			return "tokens.install_hint";
		},
	},
];

export const PROMPT_CLIENTS = [
	{ label: "Codex", logo: "/mcp-clients/codex.svg" },
	{ label: "Claude Code", logo: "/mcp-clients/claude.svg" },
	{ label: "Antigravity", logo: "/mcp-clients/antigravity.png" },
	{ label: "Augment Code", logo: "/mcp-clients/augmentcode.png" },
	{ label: "Cline", logo: "/mcp-clients/cline.png" },
	{ label: "OpenCode", logo: "/mcp-clients/opencode.png" },
	{ label: "Pi", logo: "/mcp-clients/pi.svg" },
];
