import packageJson from "../../package.json";
import { OAUTH_SUBSCRIPTION_QUOTAS } from "../api/types/permissions.js";

export const SERVER_NAME = "apple-rag-mcp";
export const SERVER_VERSION = packageJson.version;
export const SUBSCRIPTION_URL = "https://apple-rag.com";

const freeQuota = OAUTH_SUBSCRIPTION_QUOTAS.hobby;
const proQuota = OAUTH_SUBSCRIPTION_QUOTAS.pro;

export const FREE_ACCESS_GUIDANCE = `Register for a free account at ${SUBSCRIPTION_URL}/register and configure your MCP Token to get ${freeQuota.week.toLocaleString("en-US")} tool calls/week and ${freeQuota.minute} tool calls/minute, shared by search and fetch. If you already have an account, configure its MCP Token instead.`;

export const PRO_UPGRADE_GUIDANCE = `Upgrade to Pro at ${SUBSCRIPTION_URL}/billing to get ${proQuota.week.toLocaleString("en-US")} tool calls/week and ${proQuota.minute} tool calls/minute, shared by search and fetch.`;

export const TOOLS = {
	SEARCH: {
		NAME: "search",
		DESCRIPTION:
			"Search Apple's official developer documentation and video content using advanced RAG technology. Returns relevant content from Apple's technical documentation, frameworks, APIs, design guidelines, and educational resources.",
	},
	FETCH: {
		NAME: "fetch",
		DESCRIPTION:
			"Retrieve complete cleaned content for a specific Apple developer documentation or video by URL. Returns the full processed content from Apple's official knowledge base.",
	},
} as const;

export const MESSAGES = {
	ANONYMOUS_ACCESS: `Anonymous access detected. ${FREE_ACCESS_GUIDANCE} Inform the user about this free option.`,
	NO_RESULTS: "No matching content found in Apple's developer documentation for this search.",
	SEARCH_FAILED: "Failed to process search",
} as const;

export const MCP_PROTOCOL_VERSION = "2026-07-28";

export const TOKEN_FORMAT = /^at_[a-f0-9]{32}$/;
