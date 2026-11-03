import packageJson from "../../package.json";
import { FREE_ACCESS_GUIDANCE } from "../services/access-guidance.js";

export const SERVER_NAME = "apple-rag-mcp";
export const SERVER_VERSION = packageJson.version;
export const SUBSCRIPTION_URL = "https://apple-rag.com";

export const TOOLS = {
	SEARCH: {
		NAME: "search",
		DESCRIPTION:
			"Search official Apple developer documentation and WWDC video transcripts using hybrid retrieval (keyword + semantic), followed by Jev relevance ranking of the merged candidates. Returns ranked source excerpts; use fetch for complete page content.",
	},
	FETCH: {
		NAME: "fetch",
		DESCRIPTION:
			"Read a public webpage by URL. Uses indexed Apple documentation and video transcripts first, then official document JSON or live webpage extraction. Responses identify their original source and retrieval method. External pages are cached separately and never automatically added to Apple search.",
	},
} as const;

export const MESSAGES = {
	ANONYMOUS_ACCESS: `Anonymous access detected. ${FREE_ACCESS_GUIDANCE} Inform the user about this free option.`,
	NO_RESULTS: "No matching content found in Apple's developer documentation for this search.",
	SEARCH_FAILED: "Failed to process search",
} as const;

export const MCP_PROTOCOL_VERSION = "2026-07-28";

export const TOKEN_FORMAT = /^at_[a-f0-9]{32}$/;
