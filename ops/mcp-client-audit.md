# MCP Client Configuration Audit

Reviewed on 2026-10-02. Scope: dashboard install/copy buttons, the two expanded
configuration guides, and the examples in the bundled skill.

## Findings

| Client | Official contract | Result |
| --- | --- | --- |
| Generic copied JSON | Portable `mcpServers` HTTP entries need `type: "http"` when used by Claude Code. | Add the explicit type; keep native Cursor, Cline, and Antigravity outputs separate. |
| [Cursor](https://cursor.com) | Install URI with server name and Base64-encoded server configuration; HTTP uses `url` and `headers`. | Use the documented direct install URI, preserve the selected URL, and encode JSON as UTF-8. |
| [VS Code](https://github.com/microsoft/vscode) | Install URI accepts a percent-encoded JSON payload containing `name`, `type: "http"`, `url`, and `headers`. | Include the HTTP type explicitly. The official URI handler can infer it from the URL, so the previous omission was not necessarily a failure. |
| [VS Code Insiders](https://github.com/microsoft/vscode) | Same payload, with the `vscode-insiders:` scheme. | Same explicit HTTP type. |
| [Codex](https://github.com/openai/codex) | `~/.codex/config.toml`, `[mcp_servers.<name>]`, `url`, and `http_headers`. | Existing TOML is correct. Retain literal bearer authentication and replace the outdated documentation link. |
| [Claude Code](https://github.com/anthropics/claude-code) | `claude mcp add --transport http`, `--scope user`, and `--header`. | Existing options are correct. Quote URL/header arguments for POSIX shells and keep the skill example aligned. |
| [Antigravity](https://antigravity.google) | `mcpServers`, `serverUrl`, and `headers`. | Existing JSON is correct; leave it unchanged. |
| [Augment Code](https://www.augmentcode.com) | `mcpServers`, `type: "http"`, `url`, and `headers` in Auggie settings. | Existing JSON is correct. Remove the false blanket warning that Authorization headers are unsupported. |
| [Cline](https://github.com/cline/cline) | `mcpServers`, `type: "streamableHttp"`, `url`, `headers`, `disabled`, and `autoApprove`. | Replace the invalid transport spelling and `alwaysAllow`; retain approval of only the two existing read tools. |

## Primary Sources

- [Cursor MCP configuration](https://cursor.com/docs/context/mcp)
- [Cursor install links](https://cursor.com/docs/mcp/install-links)
- [VS Code MCP configuration](https://code.visualstudio.com/docs/agent-customization/mcp-servers)
- [VS Code install URI implementation](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/mcp/browser/mcpWorkbenchService.ts)
- [Codex MCP documentation](https://developers.openai.com/codex/mcp)
- [Claude Code MCP documentation](https://code.claude.com/docs/en/mcp)
- [Antigravity MCP documentation](https://antigravity.google/docs/mcp)
- [Augment MCP settings and headers](https://docs.augmentcode.com/cli/integrations)
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
- Preserve existing raw-text clipboard behavior and local logo assets.

This is a configuration-contract audit, not a claim that every installed editor
has connected successfully. External-protocol approval, an installed client,
and support for the production server's protocol revision are separate checks.
No personal client configuration, real credentials, billing, database behavior,
or unrelated dependencies are changed by this audit.
