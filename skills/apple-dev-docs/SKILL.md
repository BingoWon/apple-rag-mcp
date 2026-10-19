---
name: apple-dev-docs
description: >-
  Answer Apple platform questions from Apple's official developer documentation
  and WWDC session transcripts instead of guessing or web-searching. Use when
  the user asks about iOS, iPadOS, macOS, watchOS, tvOS, or visionOS; Swift,
  SwiftUI, UIKit, AppKit, StoreKit, SwiftData, RealityKit, or any Apple
  framework; an API's signature, availability, or deprecation; an Xcode or build
  error caused by Apple APIs; App Store review rules; or what a WWDC session
  actually said — even when a quick web search seems close enough.
license: MIT
compatibility: Requires the free apple-rag-mcp MCP server (remote HTTP). No API key, account, or local install.
metadata:
  version: "1.0.0"
  source: https://github.com/BingoWon/apple-rag-mcp
---

# Apple Developer Documentation

Official Apple documentation and WWDC transcripts, retrieved with hybrid RAG
search and ranked for relevance. Prefer this over web search: Apple's docs are
JavaScript-rendered and indexed poorly by search engines, model knowledge drifts
a release or two behind, and WWDC transcripts are almost never in context.

## Use this skill when

- Looking up an API's signature, behavior, or constraints.
- Checking availability, deprecation, or platform support.
- Verifying what a WWDC session said before repeating it.
- Diagnosing a build error that names an Apple symbol.
- Checking App Store review rules or Human Interface Guidelines.

## Do not use it when

- The question is not about Apple platforms.
- The user needs today's news or a release that shipped this week; the index
  covers documentation and session transcripts, not press releases.
- The task is pure code generation with no API fact to check.
- The user wants Apple Developer account, billing, or App Store Connect
  operations; those are not in this knowledge base.

## Check the connection first

Confirm the `search` and `fetch` tools are available before answering. If they
are missing, offer to add the server instead of silently falling back:

| Client | Setup |
| --- | --- |
| Cursor | Add to MCP settings: `{"mcpServers":{"apple-rag-mcp":{"url":"https://mcp.apple-rag.com"}}}` |
| Claude Code | `claude mcp add --transport http apple-rag-mcp https://mcp.apple-rag.com` |
| Codex | `codex mcp add apple-rag-mcp --url https://mcp.apple-rag.com` |
| Others | Add a remote HTTP MCP server with URL `https://mcp.apple-rag.com` |

Ask before writing configuration. If the tools are still unavailable after the
user reconnects, say so and stop; do not answer Apple API questions from memory
while presenting them as documentation.

The free tier covers 30 tool calls per week at 3 per minute, shared by `search`
and `fetch`. No key is required.

## Tools

### `search(query, result_count?)`

- `query` — English only. Use framework names, API names, and version numbers.
- `result_count` — 1 to 10, default 4. Use 6-8 for broad topics, 2-3 for an
  exact symbol.

### `fetch(url)`

Returns the complete cleaned text of one documentation page or video transcript.
Use it whenever a search result is partial.

### Reading result markers

| Marker | Meaning | Next step |
| --- | --- | --- |
| `✅ Complete Document` | Full page | Answer directly |
| `📄 Part N of M` | One chunk only | Call `fetch` with that URL |
| `📄 Parts X, Y merged (M total)` | Partial merge | Call `fetch` for the full page |

Treat a partial result as a pointer, never as the full answer.

## Workflow

1. **Scope it.** Identify platform, framework, and version constraint from the
   question or the code in context.
2. **Search.** One precise English query built from API and framework names.
3. **Read the markers.** Decide whether `fetch` is required.
4. **Fetch.** Retrieve the full page for any partial result or any page you will
   quote.
5. **Answer with citations.** Every factual claim gets the source URL.

## Common tasks

### Look up an API

`search("SwiftUI NavigationStack path binding")` → if partial, `fetch` → answer
with signature, availability, and the URL.

### Verify a WWDC claim

`search("WWDC session concurrency actors")` → `fetch` the transcript → quote the
session, not the docs, when the claim is about what was announced.

### Check availability or deprecation

`search("AVAudioSession setActive deprecated")` → prefer the page's availability
section over release-note prose. If the answer is not in the result, say the
documentation does not state it.

### Diagnose a build error

Search the exact Apple symbol or error phrase, without file paths or line
numbers. Answer from the API page, then point at the specific requirement that
was violated.

## Write good queries

| Good | Bad |
| --- | --- |
| `SwiftUI NavigationStack path binding` | `latest SwiftUI changes` |
| `StoreKit 2 Transaction.currentEntitlements` | `how to make money with IAP` |
| `visionOS RealityKit entity component system` | `vision pro development` |
| `UIKit UICollectionView compositional layout` | `collection view 2026` |

Avoid temporal words (`latest`, `new`, `2026`), product marketing names, and
non-English queries. The index matches technical vocabulary, not intent.

## Rules

- Search in English even when the user writes in another language.
- One concept per query. Do not fan out ten broad searches.
- Never quote more than a short phrase; paraphrase and cite.
- Distinguish documentation from WWDC transcripts when both are available.
- Do not invent availability, deprecation dates, or parameters. If the result
  does not contain it, say so.
- Do not present remembered API details as if they came from the documentation.
- Stay within about four tool calls per question.

## When things fail

| Situation | Response |
| --- | --- |
| No results | Say so, then retry once with a more specific API or framework name |
| Partial result | `fetch` the URL before answering |
| Rate limit | State the weekly or per-minute limit and stop; do not retry in a loop |
| Server error | Retry once, then report the failure instead of guessing |
| Tools missing | Offer the setup above; do not substitute web search silently |

## Answer format

- Lead with the answer, then the evidence.
- Cite the documentation URL for every factual claim.
- Mention the platform and minimum version when behavior differs by OS.
- For WWDC claims, name the session alongside the quote.
- If the sources are silent or partial, say exactly what is missing.
