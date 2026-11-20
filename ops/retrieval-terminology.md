# Retrieval Terminology

Use these meanings in website copy, plan features, documentation, and MCP tool
descriptions:

- Keyword search retrieves sources by terms such as API and framework names.
- Semantic search uses query/document embeddings to retrieve similar content.
- Hybrid search combines keyword and semantic retrieval.
- [Jev](https://typesafe.ai/) scores and reranks the merged candidates from both
  retrieval paths. Its role is relevance ranking after retrieval.
- RAG is the workflow of supplying retrieved sources to an agent or model to
  support answer generation; it is broader than semantic search. See the
  [original RAG paper](https://arxiv.org/abs/2005.11401).

The implementation runs both recall paths, merges their candidates, and then
calls the relevance ranker in `worker/services/search-engine.ts`. The MCP
server returns source excerpts or complete pages; the calling agent writes the
answer.

"RAG + Jev" may describe the overall technology stack. Define hybrid search as
"keyword + semantic" and describe relevance ranking separately. Do not require
every retrieval-related string to contain both brand names.

Pricing uses concise annotations: "Semantic search (for RAG)" and
"Hybrid search (ranked by [Jev](https://typesafe.ai/))". These identify the
intended use and ranker, while the descriptions explain the retrieval steps.

## Tool order and selection

Present the tools in the following order whenever all three appear together. Use
this order in tool discovery, CLI help, setup prompts, documentation, chart
legends, and log navigation. The shared ordered list is `TOOL_KINDS` in
`shared/tool-activity.ts`. Keep each tool’s chart color and log target bound to
its name, including when a chart omits an empty series.

| Tool | Chinese label | When an agent should use it |
| --- | --- | --- |
| `search` | 搜索 | Answer a specific Apple API or WWDC question. Cite the returned passage when it provides enough evidence. |
| `browse` | 浏览目录 | Discover the topics or APIs in an indexed framework. The directory listing itself can answer a navigation question. |
| `fetch` | 读取原文 | Read a known URL directly, or open a source found through search or browse when more context is needed. |

Search and browse both help an agent discover sources. Fetch reads a selected
page. An agent can start with any tool and stop as soon as it can answer.
Task-specific examples only need to mention the tools the task uses.
