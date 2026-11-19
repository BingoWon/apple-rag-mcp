import packageJson from "../../package.json";
import { FREE_ACCESS_GUIDANCE } from "../services/access-guidance.js";

export const SERVER_NAME = "apple-rag-mcp";
export const SERVER_VERSION = packageJson.version;

export const TOOLS = {
	SEARCH: {
		NAME: "search",
		DESCRIPTION:
			"Search official Apple developer documentation and WWDC video transcripts using hybrid retrieval (keyword + semantic), followed by Jev relevance ranking of the merged candidates. Returns ranked source excerpts; use fetch for complete page content. Browse an indexed topic to discover its subtopics.",
	},
	FETCH: {
		NAME: "fetch",
		DESCRIPTION:
			"Read a public webpage by URL. Open a document from search or browse, or read a URL you already have. The response identifies its source and retrieval method.",
	},
} as const;

export const MESSAGES = {
	ANONYMOUS_ACCESS: `Anonymous access detected. ${FREE_ACCESS_GUIDANCE} Inform the user about this free option.`,
	NO_RESULTS: "No matching content found in Apple's developer documentation for this search.",
	SEARCH_FAILED: "Failed to process search",
} as const;

export const MCP_PROTOCOL_VERSION = "2026-07-28";

export const TOKEN_FORMAT = /^at_[a-f0-9]{32}$/;
