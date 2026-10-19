# Install Apple RAG MCP

Remote Streamable HTTP MCP server. No API key is required for the free tier.

- Endpoint: `https://mcp.apple-rag.com`
- Tools: `search` (query, result_count 1-10), `fetch` (url)
- Free tier: 30 tool calls per week, 3 per minute, shared by both tools.

## Cline

Add this entry to the MCP servers configuration:

```json
{
  "mcpServers": {
    "apple-rag-mcp": {
      "type": "streamableHttp",
      "url": "https://mcp.apple-rag.com"
    }
  }
}
```

## Claude Code

```bash
claude mcp add --transport http apple-rag-mcp https://mcp.apple-rag.com
```

## Cursor

```json
{
  "mcpServers": {
    "apple-rag-mcp": {
      "url": "https://mcp.apple-rag.com"
    }
  }
}
```

## Verify

Call `search` with the query `SwiftUI NavigationStack path binding` and expect documentation results from
`developer.apple.com`. Then call `fetch` with one of the returned URLs to confirm full-page retrieval.
