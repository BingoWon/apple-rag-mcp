import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { type MCPClientType, MCPConfigService } from "@/utils/mcpConfigService";

interface MCPInstallButtonsProps {
	token: string;
	serverUrl: string;
	disabled?: boolean;
	className?: string;
}

interface ClientConfig {
	logo: string;
	alt: string;
	text: string;
	action: (token: string, serverUrl: string) => Promise<void>;
}

const CLIENT_CONFIGS: Record<Exclude<MCPClientType, "generic">, ClientConfig> = {
	codex: {
		logo: "https://api.iconify.design/logos:openai-icon.svg",
		alt: "OpenAI Codex",
		text: "Copy for Codex",
		action: async (token) => {
			const configToml = MCPConfigService.generateTomlString(token);
			await navigator.clipboard.writeText(configToml);
			toast.success("Codex configuration copied to clipboard!");
		},
	},
	cursor: {
		logo: "https://cursor.com/_next/static/media/placeholder-logo.da8a9d2b.webp",
		alt: "Cursor",
		text: "Add to Cursor",
		action: async (token) => {
			const cursorUrl = MCPConfigService.generateCursorLink(token);
			window.open(cursorUrl, "_blank");
			toast.success("Look for the Cursor window and click 'Install' to add MCP.");
		},
	},
	roocode: {
		logo: "https://roocode.com/favicon.ico",
		alt: "Roo Code",
		text: "Copy for Roo Code",
		action: async (token, serverUrl) => {
			const configJson = MCPConfigService.generateJsonString({
				token,
				serverUrl,
				clientType: "roocode",
			});
			await navigator.clipboard.writeText(configJson);
			toast.success("Roo Code configuration copied to clipboard!");
		},
	},
	cline: {
		logo: "https://cline.bot/assets/branding/favicons/favicon-32x32.png",
		alt: "Cline",
		text: "Copy for Cline",
		action: async (token, serverUrl) => {
			const configJson = MCPConfigService.generateJsonString({
				token,
				serverUrl,
				clientType: "cline",
			});
			await navigator.clipboard.writeText(configJson);
			toast.success("Cline configuration copied to clipboard!");
		},
	},
	augmentcode: {
		logo: "https://www.augmentcode.com/favicon.ico",
		alt: "Augment Code",
		text: "Copy for Augment Code",
		action: async (token, serverUrl) => {
			const configJson = MCPConfigService.generateJsonString({
				token,
				serverUrl,
				clientType: "augmentcode",
			});
			await navigator.clipboard.writeText(configJson);
			toast.success("Augment Code configuration copied to clipboard!");
		},
	},
	vscode: {
		logo: "https://api.iconify.design/vscode-icons:file-type-vscode.svg",
		alt: "VS Code",
		text: "Install in VS Code",
		action: async (token, serverUrl) => {
			const installUrl = MCPConfigService.generateVSCodeInstallUrl(token, serverUrl);
			window.open(installUrl, "_blank");
			toast.success("Look for the VS Code window and click 'Install' to add MCP.");
		},
	},
	"vscode-insiders": {
		logo: "https://api.iconify.design/vscode-icons:file-type-vscode-insiders.svg",
		alt: "VS Code Insiders",
		text: "Install in VS Code Insiders",
		action: async (token, serverUrl) => {
			const installUrl = MCPConfigService.generateVSCodeInsidersInstallUrl(token, serverUrl);
			window.open(installUrl, "_blank");
			toast.success("Look for the VS Code Insiders window and click 'Install' to add MCP.");
		},
	},
	claudecode: {
		logo: "https://api.iconify.design/logos:claude-icon.svg",
		alt: "Claude Code",
		text: "Copy for Claude Code",
		action: async (token, serverUrl) => {
			const command = MCPConfigService.generateClaudeCodeCommand(token, serverUrl);
			await navigator.clipboard.writeText(command);
			toast.success("Claude Code command copied to clipboard!");
		},
	},
};

const BUTTON_TYPES = [
	"cursor",
	"augmentcode",
	"codex",
	"claudecode",
	"cline",
	"roocode",
	"vscode",
	"vscode-insiders",
] as const;
type SupportedClientType = (typeof BUTTON_TYPES)[number];

function InstallButton({
	type,
	token,
	serverUrl,
	disabled,
}: {
	type: SupportedClientType;
	token: string;
	serverUrl: string;
	disabled: boolean;
}) {
	const config = CLIENT_CONFIGS[type];

	const handleClick = async () => {
		try {
			await config.action(token, serverUrl);
		} catch (_error) {
			toast.error(`Failed to ${config.text.toLowerCase()}`);
		}
	};

	return (
		<button
			onClick={handleClick}
			disabled={disabled}
			className={cn(
				"inline-flex items-center justify-center gap-2",
				"px-2 py-1 rounded-md text-base font-semibold transition-all duration-200",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
				"disabled:opacity-50 disabled:cursor-not-allowed",
				"bg-light text-inverse border border-default shadow-button",
				"hover:shadow-complex hover:bg-inverse hover:text-light hover:border-brand hover:scale-[1.02]",
				"active:scale-[0.98]",
			)}
		>
			<img src={config.logo} alt={config.alt} className="w-5 h-5 bg-white rounded-sm" />
			{config.text}
		</button>
	);
}

export function MCPInstallButtons({
	token,
	serverUrl,
	disabled = false,
	className,
}: MCPInstallButtonsProps) {
	return (
		<div className={cn("flex flex-wrap justify-center gap-3", className)}>
			{BUTTON_TYPES.map((type) => (
				<InstallButton
					key={type}
					type={type}
					token={token}
					serverUrl={serverUrl}
					disabled={disabled}
				/>
			))}
		</div>
	);
}
