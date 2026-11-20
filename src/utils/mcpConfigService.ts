import { MCP_SERVER_NAME, MCP_SERVER_URL } from "@/constants/mcp";
import {
	MCP_CLIENT_HEADER,
	MCP_CLIENT_NAMES,
	type MCPClientId,
	mcpClientIds,
} from "../../shared/mcp-clients";

export interface MCPServerConfig {
	url: string;
	headers: Record<string, string>;
	type: "http";
}

export interface MCPConfigOptions {
	token: string;
	serverUrl?: string;
	client?: MCPClientId;
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
	const { token, serverUrl = MCP_SERVER_URL, client } = options;
	return {
		type: "http",
		url: serverUrl,
		headers: {
			Authorization: `Bearer ${token}`,
			...(client ? { [MCP_CLIENT_HEADER]: client } : {}),
		},
	};
}

export function generateInstallPrompt(
	{ token, serverUrl = MCP_SERVER_URL }: Pick<MCPConfigOptions, "serverUrl"> & { token?: string },
	language = "en",
): string {
	const labels = mcpClientIds(language)
		.map((id) => `${MCP_CLIENT_NAMES[id]}=${id}`)
		.join(", ");
	return (
		language.startsWith("zh")
			? [
					`请为你当前使用的客户端配置 ${MCP_SERVER_NAME}，不要配置其他客户端。`,
					"",
					`服务名称：${MCP_SERVER_NAME}`,
					`服务地址：${serverUrl}`,
					"传输方式：远程 HTTP",
					token
						? `认证请求头：Authorization: Bearer ${token}`
						: "先使用匿名体验，不发送 Authorization 请求头。使用账号套餐时，从 https://apple-rag.com/overview 获取专属接入提示词。",
					"",
					`如果能确认当前 MCP 客户端且它支持自定义请求头，请为 Apple RAG 设置 ${MCP_CLIENT_HEADER}。按实际客户端选择值：${labels}。无法确认时省略此头。`,
					"DeepSeek Harness 可通过 MCP 设置或 @deepseek-ai/dsh-mcp-client 配置 streamable-http；WorkBuddy 使用 MCP 连接器，TRAE 使用 MCP Server 设置。只操作当前客户端。",
					"使用当前客户端、当前版本支持的原生命令或配置格式，优先配置到个人用户范围，保留其他已有配置。",
					"服务同时支持 MCP 2026-07-28 和客户端原有的 initialize 握手（2025-11-25、2025-06-18、2025-03-26）。不要因为客户端未发送 MCP-Protocol-Version 而判定不兼容。",
					"完成后检查连接，通过 tools/list 确认有 search、browse 和 fetch 三项工具。查询具体问题用 search，了解一个主题有哪些文档用 browse，已有 URL 需要读取原文时直接用 fetch。资料足以回答时即可停止。",
					"若需要重启或重新加载，请明确说明。不要仅凭配置已写入就报告成功，也不要输出完整 Token。",
				]
			: [
					`Configure ${MCP_SERVER_NAME} for the client you are currently using, not other clients.`,
					"",
					`Server name: ${MCP_SERVER_NAME}`,
					`Server URL: ${serverUrl}`,
					"Transport: remote HTTP",
					token
						? `Authentication header: Authorization: Bearer ${token}`
						: "Start with the anonymous trial and omit the Authorization header. For account access, get a personalized setup prompt from https://apple-rag.com/overview.",
					"",
					`If the current MCP client supports custom request headers, set ${MCP_CLIENT_HEADER} to its matching ID: ${labels}. Omit the header if you cannot identify the client.`,
					"Use the native command or configuration format supported by this client version. Prefer user-level configuration and preserve other existing settings.",
					"The server accepts both MCP 2026-07-28 and the client's existing initialize handshake (2025-11-25, 2025-06-18, and 2025-03-26). Do not treat a missing MCP-Protocol-Version header as incompatibility.",
					"After configuration, use tools/list to confirm that search, browse, and fetch are available. Use search for a specific question, browse to explore a topic, or fetch to read a known URL directly. Stop when you have enough evidence.",
					"If a restart or reload is required, say so. Do not report success based only on writing configuration, and do not print the full token.",
				]
	).join("\n");
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
		`${MCP_CLIENT_HEADER} = "codex"`,
	].join("\n");
}

export function generateClaudeCodeCommand(token: string, serverUrl?: string): string {
	const config = generateServerConfig({ token, serverUrl, client: "claude" });
	return `claude mcp add-json --scope user ${MCP_SERVER_NAME} ${shellArgument(JSON.stringify(config))}`;
}

function encodeInstallConfig(config: object) {
	return encodeURIComponent(
		btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(config)))),
	);
}

export function generateTraeInstallUrl(token: string, serverUrl?: string): string {
	const { url, headers } = generateServerConfig({ token, serverUrl, client: "trae" });
	return `trae-cn://trae.ai-ide/mcp-import?type=http&name=${encodeURIComponent(MCP_SERVER_NAME)}&config=${encodeInstallConfig({ url, headers })}`;
}

export function generateCursorLink(token: string, serverUrl?: string): string {
	const { url, headers } = generateServerConfig({ token, serverUrl, client: "cursor" });
	return `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(MCP_SERVER_NAME)}&config=${encodeInstallConfig({ url, headers })}`;
}

export function generateVSCodeInstallUrl(token: string, serverUrl?: string): string {
	const config = {
		name: MCP_SERVER_NAME,
		...generateServerConfig({ token, serverUrl, client: "vscode" }),
	};
	return `vscode:mcp/install?${encodeURIComponent(JSON.stringify(config))}`;
}

export function generateVSCodeInsidersInstallUrl(token: string, serverUrl?: string): string {
	const config = {
		name: MCP_SERVER_NAME,
		...generateServerConfig({ token, serverUrl, client: "vscode" }),
	};
	return `vscode-insiders:mcp/install?${encodeURIComponent(JSON.stringify(config))}`;
}
