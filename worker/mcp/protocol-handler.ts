import {
	type AuthInfo,
	createMcpHandler,
	McpServer,
	preloadSchemas,
} from "@modelcontextprotocol/server";
import type { AuthContext, Services } from "../mcp-types/index.js";
import { logger } from "../mcp-utils/logger.js";
import { SERVER_NAME, SERVER_VERSION, TOOLS } from "./constants.js";
import { FETCH_TOOL_INPUT_SCHEMA, FetchTool } from "./tools/fetch-tool.js";
import { SEARCH_TOOL_INPUT_SCHEMA, SearchTool } from "./tools/search-tool.js";

preloadSchemas();

const SERVER_INSTRUCTIONS =
	"Search Apple's official developer documentation and WWDC video transcripts with search, then use fetch when complete page content is needed.";

export class MCPProtocolHandler {
	constructor(private services: Services) {}

	async handleRequest(request: Request, authContext: AuthContext): Promise<Response> {
		const handler = createMcpHandler(() => this.createServer(request, authContext), {
			legacy: "stateless",
			onerror: (error) => {
				void logger.error(`MCP protocol error: ${error.message}`);
			},
		});

		return handler.fetch(request, {
			authInfo: this.toAuthInfo(authContext),
		});
	}

	private createServer(request: Request, authContext: AuthContext): McpServer {
		const server = new McpServer(
			{
				name: SERVER_NAME,
				version: SERVER_VERSION,
			},
			{
				instructions: SERVER_INSTRUCTIONS,
				cacheHints: {
					"server/discover": { ttlMs: 3_600_000, cacheScope: "public" },
					"tools/list": { ttlMs: 3_600_000, cacheScope: "public" },
				},
			},
		);

		const searchTool = new SearchTool(this.services);
		const fetchTool = new FetchTool(this.services);

		server.registerTool(
			TOOLS.SEARCH.NAME,
			{
				description: TOOLS.SEARCH.DESCRIPTION,
				inputSchema: SEARCH_TOOL_INPUT_SCHEMA,
			},
			(args) => searchTool.handle(args, authContext, request),
		);

		server.registerTool(
			TOOLS.FETCH.NAME,
			{
				description: TOOLS.FETCH.DESCRIPTION,
				inputSchema: FETCH_TOOL_INPUT_SCHEMA,
			},
			(args) => fetchTool.handle(args, authContext, request),
		);

		return server;
	}

	private toAuthInfo(authContext: AuthContext): AuthInfo | undefined {
		if (!authContext.isAuthenticated) {
			return undefined;
		}

		return {
			token: authContext.token ?? "ip-based",
			clientId: authContext.userId ?? "apple-rag-user",
			scopes: ["rag.read"],
			extra: {
				email: authContext.email,
			},
		};
	}
}
