import {
	type CallToolResult,
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
	constructor(private servicesFactory: () => Services | Promise<Services>) {}

	async handleRequest(request: Request): Promise<Response> {
		let services: Services | undefined;
		let toolCall: Promise<CallToolResult> | undefined;
		const trackTool = (promise: Promise<CallToolResult>) => {
			toolCall = promise;
			return promise;
		};
		const handler = createMcpHandler(
			async () => {
				services = await this.servicesFactory();
				const authContext = await services.auth.optionalAuth(request);
				return this.createServer(services, request, authContext, trackTool);
			},
			{
				legacy: "reject",
				onerror: (error) => {
					if (!request.signal.aborted) {
						void logger.error(`MCP protocol error: ${error.message}`);
					}
				},
			},
		);
		try {
			return await handler.fetch(request);
		} finally {
			await handler.close();
			// A disconnected transport finishes before tool cleanup and quota refunds.
			await toolCall?.catch(() => {});
			await services?.database.close();
		}
	}

	private createServer(
		services: Services,
		request: Request,
		authContext: AuthContext,
		trackTool: (promise: Promise<CallToolResult>) => Promise<CallToolResult>,
	): McpServer {
		const server = new McpServer(
			{
				name: SERVER_NAME,
				version: SERVER_VERSION,
			},
			{
				instructions: SERVER_INSTRUCTIONS,
				capabilities: { tools: { listChanged: false } },
				cacheHints: {
					"server/discover": { ttlMs: 3_600_000, cacheScope: "public" },
					"tools/list": { ttlMs: 3_600_000, cacheScope: "public" },
				},
			},
		);

		const searchTool = new SearchTool(services);
		const fetchTool = new FetchTool(services);

		server.registerTool(
			TOOLS.SEARCH.NAME,
			{
				description: TOOLS.SEARCH.DESCRIPTION,
				inputSchema: SEARCH_TOOL_INPUT_SCHEMA,
				annotations: { readOnlyHint: true, destructiveHint: false },
			},
			(args, ctx) => trackTool(searchTool.handle(args, authContext, request, ctx.mcpReq.signal)),
		);

		server.registerTool(
			TOOLS.FETCH.NAME,
			{
				description: TOOLS.FETCH.DESCRIPTION,
				inputSchema: FETCH_TOOL_INPUT_SCHEMA,
				annotations: { readOnlyHint: true, destructiveHint: false },
			},
			(args, ctx) => trackTool(fetchTool.handle(args, authContext, request, ctx.mcpReq.signal)),
		);

		return server;
	}
}
