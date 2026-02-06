/**
 * MCP Server Manifest
 * Centralized server discovery and capability information
 */

export const SERVER_MANIFEST = {
  name: "Apple RAG MCP Server",
  title: "Apple Developer Documentation Search",
  version: "2.0.0",
  description:
    "Ultra-modern MCP server providing AI agents with comprehensive access to Apple's complete developer documentation using advanced RAG technology.",
  protocolVersion: "2025-11-25",
  supportedVersions: ["2025-11-25", "2025-06-18", "2025-03-26"],
  capabilities: {
    tools: { listChanged: true },
    logging: {},
    experimental: {},
  },
  serverInfo: {
    name: "Apple RAG MCP Server",
    version: "2.0.0",
  },
  endpoints: {
    mcp: "/",
    manifest: "/manifest",
    health: "/health",
  },
  transport: {
    type: "http",
    methods: ["POST"],
    headers: {
      required: ["Content-Type"],
      optional: ["Authorization", "MCP-Protocol-Version"],
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
  version: "2.0.0",
  protocol: "2025-11-25",
  supportedVersions: ["2025-11-25", "2025-06-18", "2025-03-26"],
} as const;
