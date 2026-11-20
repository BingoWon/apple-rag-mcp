import ClaudeCode from "@thesvg/react/claude-code";
import Cline from "@thesvg/react/cline";
import Cursor from "@thesvg/react/cursor";
import DeepSeek from "@thesvg/react/deepseek";
import Antigravity from "@thesvg/react/google-antigravity";
import ChatGPT from "@thesvg/react/openai-chatgpt";
import OpenCode from "@thesvg/react/opencode";
import Pi from "@thesvg/react/pi";
import TRAE from "@thesvg/react/trae";
import VSCode from "@thesvg/react/visual-studio-code";
import WorkBuddy from "@thesvg/react/workbuddy";
import { type ComponentType, createElement, type SVGProps } from "react";
import {
	generateCursorLink,
	generateTraeInstallUrl,
	generateVSCodeInsidersInstallUrl,
	generateVSCodeInstallUrl,
} from "@/utils/mcpConfigService";
import { MCP_CLIENT_NAMES, type MCPClientId, mcpClientIds } from "../../shared/mcp-clients";

const guides = {
	codex: { Logo: ChatGPT, href: "https://developers.openai.com/codex/mcp" },
	claude: { Logo: ClaudeCode, href: "https://code.claude.com/docs/en/mcp" },
	opencode: { Logo: OpenCode, href: "https://opencode.ai/docs/mcp-servers/" },
	pi: { Logo: Pi, href: "https://github.com/earendil-works/pi" },
	antigravity: { Logo: Antigravity, href: "https://antigravity.google/docs/mcp" },
	cursor: {
		Logo: (props) => createElement(Cursor, { ...props, variant: "light" }),
		href: "https://cursor.com/docs/context/mcp",
	},
	vscode: {
		Logo: VSCode,
		href: "https://code.visualstudio.com/docs/copilot/customization/mcp-servers",
	},
	cline: { Logo: Cline, href: "https://docs.cline.bot/mcp/mcp-overview" },
	"deepseek-harness": {
		Logo: DeepSeek,
		href: "https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/mcp/mcp-client/README.md",
	},
	workbuddy: {
		Logo: WorkBuddy,
		href: "https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/MCP-Guide",
	},
	trae: { Logo: TRAE, href: "https://docs.trae.cn/ide_add-mcp-servers" },
} satisfies Record<MCPClientId, { Logo: ComponentType<SVGProps<SVGSVGElement>>; href: string }>;

export function supportedClients(language?: string) {
	return mcpClientIds(language).map((id) => ({ id, label: MCP_CLIENT_NAMES[id], ...guides[id] }));
}

export interface NativeInstallClient {
	key: string;
	label: string;
	Logo: ComponentType<SVGProps<SVGSVGElement>>;
	installUrl: (token: string, serverUrl?: string) => string;
}

export function nativeInstallClients(language?: string): NativeInstallClient[] {
	return supportedClients(language).flatMap((client): NativeInstallClient[] => {
		const base = { key: client.id, label: client.label, Logo: client.Logo };
		switch (client.id) {
			case "cursor":
				return [{ ...base, installUrl: generateCursorLink }];
			case "vscode":
				return [
					{ ...base, installUrl: generateVSCodeInstallUrl },
					{
						...base,
						key: "vscode-insiders",
						label: "VS Code Insiders",
						installUrl: generateVSCodeInsidersInstallUrl,
					},
				];
			case "trae":
				return [{ ...base, installUrl: generateTraeInstallUrl }];
			default:
				return [];
		}
	});
}
