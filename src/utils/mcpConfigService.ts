import { MCP_SERVER_NAME, MCP_SERVER_URL } from "@/constants/mcp";

export interface MCPServerConfig {
	url: string;
	headers: Record<string, string>;
	type: "http";
}

export interface MCPConfigOptions {
	token: string;
	serverUrl?: string;
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
	const { token, serverUrl = MCP_SERVER_URL } = options;
	return {
		type: "http",
		url: serverUrl,
		headers: { Authorization: `Bearer ${token}` },
	};
}

export function generateInstallPrompt(
	{ token, serverUrl = MCP_SERVER_URL }: MCPConfigOptions,
	language = "en",
): string {
	return (
		language.startsWith("zh")
			? [
					`请为你当前使用的客户端配置 ${MCP_SERVER_NAME}，不要配置其他客户端。`,
					"",
					`服务名称：${MCP_SERVER_NAME}`,
					`服务地址：${serverUrl}`,
					"传输方式：远程 HTTP",
					`认证请求头：Authorization: Bearer ${token}`,
					"",
					"使用当前客户端、当前版本支持的原生命令或配置格式，优先配置到个人用户范围，保留其他已有配置。",
					"服务同时支持 MCP 2026-07-28 和客户端原有的 initialize 握手（2025-11-25、2025-06-18、2025-03-26）。不要因为客户端未发送 MCP-Protocol-Version 而判定不兼容。",
					"完成后检查连接，列出工具，并分别验证 search 和 fetch。",
					"若需要重启或重新加载，请明确说明。不要仅凭配置已写入就报告成功，也不要输出完整 Token。",
				]
			: [
					`Configure ${MCP_SERVER_NAME} for the client you are currently using, not other clients.`,
					"",
					`Server name: ${MCP_SERVER_NAME}`,
					`Server URL: ${serverUrl}`,
					"Transport: remote HTTP",
					`Authentication header: Authorization: Bearer ${token}`,
					"",
					"Use the native command or configuration format supported by this client version. Prefer user-level configuration and preserve other existing settings.",
					"The server accepts both MCP 2026-07-28 and the client's existing initialize handshake (2025-11-25, 2025-06-18, and 2025-03-26). Do not treat a missing MCP-Protocol-Version header as incompatibility.",
					"After configuration, check the connection, list tools, and verify both search and fetch.",
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
	].join("\n");
}

export function generateClaudeCodeCommand(token: string, serverUrl?: string): string {
	const url = serverUrl || MCP_SERVER_URL;
	return `claude mcp add --transport http --scope user ${MCP_SERVER_NAME} ${shellArgument(url)} --header ${shellArgument(`Authorization: Bearer ${token}`)}`;
}

export function generateCursorLink(token: string, serverUrl?: string): string {
	const { url, headers } = generateServerConfig({ token, serverUrl });
	const config = { url, headers };
	const jsonConfig = JSON.stringify(config);
	const base64Config = btoa(String.fromCharCode(...new TextEncoder().encode(jsonConfig)));

	return `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(
		MCP_SERVER_NAME,
	)}&config=${encodeURIComponent(base64Config)}`;
}

export function generateVSCodeInstallUrl(token: string, serverUrl?: string): string {
	const config = {
		name: MCP_SERVER_NAME,
		...generateServerConfig({ token, serverUrl }),
	};
	return `vscode:mcp/install?${encodeURIComponent(JSON.stringify(config))}`;
}

export function generateVSCodeInsidersInstallUrl(token: string, serverUrl?: string): string {
	const config = {
		name: MCP_SERVER_NAME,
		...generateServerConfig({ token, serverUrl }),
	};
	return `vscode-insiders:mcp/install?${encodeURIComponent(JSON.stringify(config))}`;
}

export const MCPConfigService = {
	generateServerConfig,
	generateConfig,
	generateJsonString,
	generateInstallPrompt,
	generateCodexTomlString,
	generateClaudeCodeCommand,
	generateCursorLink,
	generateVSCodeInstallUrl,
	generateVSCodeInsidersInstallUrl,
};
