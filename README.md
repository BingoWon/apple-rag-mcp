# Apple RAG MCP

MCP server for Apple developer documentation with semantic search, RAG, and AI reranking. Covers all Apple frameworks, APIs, WWDC video transcripts, and Human Interface Guidelines.

**Endpoint**: `https://mcp.apple-rag.com`

## Setup

### Cursor

```json
{
  "mcpServers": {
    "apple-rag-mcp": {
      "url": "https://mcp.apple-rag.com"
    }
  }
}
```

### VS Code / VS Code Insiders

```json
{
  "mcpServers": {
    "apple-rag-mcp": {
      "url": "https://mcp.apple-rag.com"
    }
  }
}
```

### Claude Code

```bash
claude mcp add --transport streamable-http apple-rag-mcp https://mcp.apple-rag.com
```

### Codex

```bash
codex mcp add apple-rag-mcp --url https://mcp.apple-rag.com
```

### Cline / Roo Code

```json
{
  "mcpServers": {
    "apple-rag-mcp": {
      "type": "streamable-http",
      "url": "https://mcp.apple-rag.com"
    }
  }
}
```

### Augment Code

```json
{
  "mcpServers": {
    "apple-rag-mcp": {
      "type": "http",
      "url": "https://mcp.apple-rag.com"
    }
  }
}
```

> Augment Code does not support Authorization headers. Use [Authorized IP Addresses](https://apple-rag.com/authorized-ips) instead.

## Tools

### search

```
search(query: string, result_count?: number)
```

Search Apple developer documentation and WWDC content using semantic RAG. Queries must be in English.

### fetch

```
fetch(url: string)
```

Retrieve the complete cleaned content of a specific Apple documentation page or WWDC video transcript by URL.

## Access Tiers

| Tier | Weekly | Per-minute | Price |
|------|--------|-----------|-------|
| Anonymous | Very limited | Very limited | Free |
| Free | 50 | 5 | Free — [register](https://apple-rag.com) |
| Pro | 50,000 | 50 | $1/week — [subscribe](https://apple-rag.com) |

To authenticate, create an MCP Token on the [dashboard](https://apple-rag.com) and add it to your config:

```json
{
  "mcpServers": {
    "apple-rag-mcp": {
      "url": "https://mcp.apple-rag.com",
      "headers": {
        "Authorization": "Bearer at_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

## Agent Skill

An [Agent Skill](https://agentskills.io) is included at [`skills/apple-dev-docs/`](skills/apple-dev-docs/SKILL.md). It teaches AI agents when and how to use this MCP server — query best practices, search-then-fetch workflow, result handling, and rate limit guidance.

**Install the skill** by copying the directory to your agent's skill location:

| Platform | Destination |
|----------|-------------|
| Cursor | `~/.cursor/skills/apple-dev-docs/` or `.cursor/skills/apple-dev-docs/` |
| Codex | `~/.codex/skills/apple-dev-docs/` |
| Claude Code | Project directory |

The skill includes an `agents/openai.yaml` for Codex MCP dependency declaration.

## License

MIT
