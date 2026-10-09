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
calls the relevance ranker in `worker/mcp-services/search-engine.ts`. The MCP
server returns source excerpts or complete pages; the calling agent writes the
answer.

"RAG + Jev" may describe the overall technology stack. Define hybrid search as
"keyword + semantic" and describe relevance ranking separately. Do not require
every retrieval-related string to contain both brand names.
