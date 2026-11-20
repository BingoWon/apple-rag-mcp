export const MCP_CLIENT_NAMES = {
	codex: "Codex",
	claude: "Claude Code",
	opencode: "OpenCode",
	pi: "Pi",
	antigravity: "Antigravity",
	cursor: "Cursor",
	vscode: "VS Code",
	cline: "Cline",
	"deepseek-harness": "DeepSeek Harness",
	workbuddy: "WorkBuddy",
	trae: "TRAE",
} as const;
export type MCPClientId = keyof typeof MCP_CLIENT_NAMES;
export const MCP_CLIENT_HEADER = "X-Apple-RAG-Client";

const common = ["codex", "claude", "opencode"] as const;
const english = [...common, "pi", "antigravity", "cursor", "vscode", "cline"] as const;
const chinese = [
	...common,
	"antigravity",
	"cursor",
	"deepseek-harness",
	"workbuddy",
	"trae",
] as const;
export function mcpClientIds(language = "en"): readonly MCPClientId[] {
	return language.toLowerCase().startsWith("zh") ? chinese : english;
}
export function reportedMCPClient(value: string | null): MCPClientId | undefined {
	const id = value?.trim().toLowerCase();
	return id && Object.hasOwn(MCP_CLIENT_NAMES, id) ? (id as MCPClientId) : undefined;
}
