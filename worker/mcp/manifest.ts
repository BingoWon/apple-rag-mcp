/**
 * MCP Server Manifest
 * Centralized server discovery and capability information
 */

import { MCP_PROTOCOL_VERSION, SERVER_NAME, SERVER_VERSION } from "./constants.js";

export const SERVER_MANIFEST = {
	name: "Apple RAG MCP Server",
	title: "Apple Developer Documentation Search",
	version: SERVER_VERSION,
	description:
		"Apple developer docs and WWDC transcripts with RAG retrieval and Jev relevance ranking.",
	protocolVersion: MCP_PROTOCOL_VERSION,
	capabilities: {
		tools: {},
	},
	serverInfo: {
		name: SERVER_NAME,
		version: SERVER_VERSION,
	},
	endpoints: {
		mcp: "https://mcp.apple-rag.com",
		manifest: "https://mcp.apple-rag.com/manifest",
		health: "https://mcp.apple-rag.com/health",
	},
	transport: {
		type: "streamable-http",
		methods: ["POST"],
		headers: {
			required: ["Content-Type", "MCP-Protocol-Version", "Mcp-Method"],
			conditional: ["Mcp-Name"],
			optional: ["Authorization"],
		},
	},
	authorization: {
		enabled: true,
		type: "bearer",
		optional: true,
	},
} as const;

export const HEALTH_STATUS = {
	status: "healthy",
	version: SERVER_VERSION,
	protocol: MCP_PROTOCOL_VERSION,
} as const;
