/**
 * MCP Server Manifest
 * Centralized server discovery and capability information
 */

import serverJson from "../../server.json";
import { MCP_PROTOCOL_VERSION, SERVER_NAME, SERVER_VERSION } from "./constants.js";

export const SERVER_MANIFEST = {
	name: "Apple RAG",
	title: "Apple RAG — Apple Developer Knowledge for AI Agents",
	version: SERVER_VERSION,
	description: serverJson.description,
	protocolVersion: MCP_PROTOCOL_VERSION,
	supportedProtocolVersions: ["2026-07-28", "2025-11-25", "2025-06-18", "2025-03-26"],
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
			required: ["Content-Type", "Accept"],
			modern: ["MCP-Protocol-Version", "Mcp-Method"],
			conditional: ["Mcp-Name"],
			optional: ["Authorization"],
		},
		legacy: {
			handshake: "initialize",
			protocolVersions: ["2025-11-25", "2025-06-18", "2025-03-26"],
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
