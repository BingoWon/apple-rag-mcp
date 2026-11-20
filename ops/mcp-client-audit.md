# MCP Client Configuration Audit

Reviewed on 2026-10-02. Scope: dashboard install/copy buttons, the two expanded
configuration guides.

## Findings

| Client | Official contract | Result |
| --- | --- | --- |
| Generic copied JSON | Portable `mcpServers` HTTP entries need `type: "http"` when used by Claude Code. | Add the explicit type; keep native Cursor, Cline, and Antigravity outputs separate. |
| [Cursor](https://cursor.com) | Install URI with server name and Base64-encoded server configuration; HTTP uses `url` and `headers`. | Use the documented direct install URI, preserve the selected URL, and encode JSON as UTF-8. |
| [VS Code](https://github.com/microsoft/vscode) | Install URI accepts a percent-encoded JSON payload containing `name`, `type: "http"`, `url`, and `headers`. | Include the HTTP type explicitly. The official URI handler can infer it from the URL, so the previous omission was not necessarily a failure. |
| [VS Code Insiders](https://github.com/microsoft/vscode) | Same payload, with the `vscode-insiders:` scheme. | Same explicit HTTP type. |
| [Codex](https://github.com/openai/codex) | `~/.codex/config.toml`, `[mcp_servers.<name>]`, `url`, and `http_headers`. | Existing TOML is correct. Retain literal bearer authentication and replace the outdated documentation link. |
| [Claude Code](https://code.claude.com/docs/en/mcp) | `claude mcp add-json --scope user` accepts an HTTP endpoint and multiple headers. | Shell-quote the JSON, including the bearer token and the client identifier. |
| [Antigravity](https://antigravity.google) | `mcpServers`, `serverUrl`, and `headers`. | Existing JSON is correct; leave it unchanged. |
| [Cline](https://github.com/cline/cline) | `mcpServers`, `type: "streamableHttp"`, `url`, `headers`, `disabled`, and `autoApprove`. | Replace the invalid transport spelling and `alwaysAllow`; retain approval of only the two existing read tools. |

## Primary Sources

- [Cursor MCP configuration](https://cursor.com/docs/context/mcp)
- [Cursor install links](https://cursor.com/docs/mcp/install-links)
- [VS Code MCP configuration](https://code.visualstudio.com/docs/agent-customization/mcp-servers)
- [VS Code install URI implementation](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/mcp/browser/mcpWorkbenchService.ts)
- [Codex MCP documentation](https://developers.openai.com/codex/mcp)
- [Claude Code MCP documentation](https://code.claude.com/docs/en/mcp)
- [Antigravity MCP documentation](https://antigravity.google/docs/mcp)
- [Cline MCP configuration](https://docs.cline.bot/mcp/mcp-overview)

## Verification And Limits

- The anonymous install links in both READMEs still return HTTP 200 after
  redirecting from `/en/install-mcp` to `/install-mcp`; leave them unchanged.
- Decode generated install links and assert the selected URL and bearer token.
- Parse copied JSON and assert client-specific transport and approval fields.
- Check TOML escaping and load generated TOML with Codex CLI 0.154.0 in a
  temporary `CODEX_HOME`; URL and bearer header were preserved.
- Parse generated Claude commands with a real shell without running Claude.
- Exercise every registry button using mocked clipboard/window APIs.
- Preserve existing raw-text clipboard behavior and client marks.

This is a configuration-contract audit, not a claim that every installed editor
has connected successfully. External-protocol approval, an installed client,
and support for the production server's protocol revision are separate checks.
No personal client configuration, real credentials, billing, database behavior,
or unrelated dependencies are changed by this audit.

## Unified Install Entry, 2026-10-03

- Replace per-client copy buttons and the token menu's JSON action with one
  localized agent installation prompt, using the selected token and endpoint.
- Preserve the three native deep links with their original small logo corner
  radius and 16px size, without added image padding. In the stacked
  prompt logos, reduce only the two square marks to 16px; other marks stay 20px.
  Keep the JSON code block directly visible; group the
  [Codex](https://github.com/openai/codex) TOML and
  [Claude Code](https://github.com/anthropics/claude-code) command under an
  expandable manual configuration section. No configuration download is added.
- Reuse the raw-text clipboard helper. Remove unused client-specific generators,
  copy callbacks, registry entries, and translation keys.
- The homepage uses a wrapping horizontal client strip in the full section width.
- The visible JSON example is a client connection configuration, not an MCP
  protocol schema. Its `mcpServers`, `type: "http"`, `url`, and `headers` follow
  [Claude Code](https://github.com/anthropics/claude-code)
  ([official configuration](https://code.claude.com/docs/en/mcp)) and
  [VS Code](https://github.com/microsoft/vscode)
  ([portable configuration](https://code.visualstudio.com/docs/copilot/customization/mcp-servers)).
  Other clients may need different native formats. Protocol compatibility must
  still be checked separately.
- Check prompt localization, selected credentials, localized client rosters, decoded deep
  links, rendered button counts/disabled states, and visible JSON placement.
  Agent configuration remains a workflow, not a guarantee that every client
  supports the server protocol.
- Remove the dashboard-only
  [XcodeBuildMCP](https://github.com/cameroncooke/XcodeBuildMCP) recommendation,
  its component, and its dedicated translations at the user's request.

## Localized guides and reported clients

The homepage, dashboard setup prompt and token menu use the page language to
choose the client roster in `shared/mcp-clients.ts`. English includes Pi, VS Code and
Cline. Chinese ends with DeepSeek Harness, WorkBuddy and TRAE. The prompt works
for any compatible active client. Native links are offered for Cursor, VS Code
and VS Code Insiders in English, and Cursor and TRAE CN in Chinese.
The latter imports the selected endpoint and headers using TRAE's documented HTTP
install scheme. Confirmation still happens inside the client.

Client marks, GitHub, Google and Alipay use individual modules from
`@thesvg/react`. DeepSeek Harness uses the DeepSeek brand mark. First-party Apple RAG
artwork and the Jev partner mark use their original assets.

- [DeepSeek Harness Streamable HTTP configuration](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/mcp/mcp-client/README.md)
- [WorkBuddy MCP settings](https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/MCP-Guide)
- [TRAE CN configuration](https://docs.trae.cn/ide_add-mcp-servers) and [install links](https://docs.trae.cn/ide_mcp-server-install-links)
