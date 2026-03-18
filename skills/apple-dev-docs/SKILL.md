---
name: apple-dev-docs
description: >-
  Search and retrieve Apple's official developer documentation, WWDC video
  transcripts, and framework references using semantic RAG. Use when the user
  asks about Apple platforms (iOS, macOS, watchOS, tvOS, visionOS), frameworks
  (SwiftUI, UIKit, ARKit, Core Data, HealthKit, StoreKit, etc.), Swift language
  features, Xcode tooling, App Store guidelines, or any Apple developer API.
---

# Apple Developer Documentation

Provide authoritative guidance from Apple's official developer documentation and WWDC sessions using the apple-rag-mcp MCP server. Prioritize MCP tools over web search for Apple development questions.

## Quick start

- Use `search` to find relevant documentation and WWDC content.
- Use `fetch` to retrieve the complete, cleaned content of a specific page by URL.
- Always prefer MCP tools over web search for Apple-related questions.

## Tool reference

### search

```
search(query: string, result_count?: number)
```

- `query` — **Must be in English.** Focus on technical concepts, API names, framework names, and version numbers. Avoid dates and temporal language.
- `result_count` — Number of results (1–10, default 4). Use higher values for broad topics, lower for specific APIs.

### fetch

```
fetch(url: string)
```

Retrieve the full cleaned content of an Apple developer documentation page or WWDC video transcript by its URL.

## Workflow

1. **Identify scope**: Determine which Apple framework, API, or platform the question targets.
2. **Search**: Run `search` with a precise English query using framework and API names.
3. **Evaluate results**: Check each result's completeness indicator:
   - `✅ Complete Document` — Full content, use directly.
   - `📄 Part X of Y` — Partial content. Run `fetch(url)` to get the complete document.
   - `📄 Parts merged` — Multiple sections merged. Run `fetch(url)` if you need the full document.
4. **Fetch when needed**: Use `fetch` for any result that is partial, or when Additional Related Documentation URLs look relevant.
5. **Answer with citations**: Reference the source URL so the user can verify.

## Query best practices

**Good queries** — focus on technical terms and API names:

- `SwiftUI NavigationStack path binding`
- `Core Data CloudKit sync NSPersistentCloudKitContainer`
- `visionOS RealityKit entity component system`
- `StoreKit 2 Transaction.currentEntitlements`
- `UIKit UICollectionView compositional layout`

**Avoid** — temporal language, vague terms, non-English:

- ~~`latest SwiftUI changes in 2025`~~ → `SwiftUI new APIs`
- ~~`how to make an app`~~ → `iOS app lifecycle UIApplicationDelegate`
- ~~`SwiftUI 导航`~~ → `SwiftUI navigation`

## Coverage

The knowledge base covers:

- **Apple Developer Documentation**: All frameworks and APIs across iOS, macOS, watchOS, tvOS, visionOS
- **WWDC Sessions**: Video transcripts from WWDC presentations
- **Design Guidelines**: Human Interface Guidelines
- **Technical Articles**: Apple's official technical notes and guides

## Authentication

The MCP server supports both authenticated and anonymous access:

- **Anonymous**: Works without any token. Lower rate limits.
- **Authenticated**: Add a Bearer token for higher rate limits. Obtain a token at https://apple-rag.com

## If MCP server is missing

Install the MCP server with the appropriate command for your client:

**Cursor**: Add to MCP settings:
```json
{
  "mcpServers": {
    "apple-rag-mcp": {
      "url": "https://mcp.apple-rag.com"
    }
  }
}
```

**Claude Code**:
```bash
claude mcp add --transport streamable-http apple-rag-mcp https://mcp.apple-rag.com
```

**Codex**:
```bash
codex mcp add apple-rag-mcp --url https://mcp.apple-rag.com
```

## Quality rules

- Treat Apple documentation as the source of truth.
- Keep quotes short; prefer paraphrase with URL citations.
- If results seem incomplete, use `fetch` to get the full document before answering.
- If no results are found, say so and suggest refining the query with more specific API or framework names.
- Always use MCP tools before falling back to web search for Apple development questions.
