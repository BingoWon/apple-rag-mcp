import {
	type CallToolResult,
	createMcpHandler,
	McpServer,
	preloadSchemas,
} from "@modelcontextprotocol/server";
import { fetchOutputSchema, searchOutputSchema } from "../../packages/cli/src/contracts.js";
import { MCPAuthenticationError } from "../mcp-auth/auth-middleware.js";
import type { AuthContext, Services } from "../mcp-types/index.js";
import { logger } from "../mcp-utils/logger.js";
import { SERVER_NAME, SERVER_VERSION, TOOLS } from "./constants.js";
import { loggedToolInput } from "./tool-input.js";
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
		let authFailure: Error | undefined;
		const trackTool = (promise: Promise<CallToolResult>) => {
			toolCall = promise;
			return promise;
		};
		const handler = createMcpHandler(
			async () => {
				try {
					services = await this.servicesFactory();
					const authContext = await services.auth.optionalAuth(request);
					return this.createServer(services, request, authContext, trackTool);
				} catch (error) {
					authFailure =
						error instanceof MCPAuthenticationError
							? error
							: new Error("MCP authentication services unavailable.");
					throw authFailure;
				}
			},
			{
				// Cursor 3.24 still opens Streamable HTTP with initialize.
				// The SDK default serves that legacy handshake statelessly
				// beside the per-request 2026-07-28 path.
				legacy: "stateless",
				onerror: (error) => {
					if (!request.signal.aborted && !authFailure) {
						void logger.error(`MCP protocol error: ${error.message}`);
					}
				},
			},
		);
		try {
			const response = await handler.fetch(request);
			if (authFailure) {
				const invalid = authFailure instanceof MCPAuthenticationError;
				if (!invalid) void logger.error("MCP authentication services unavailable.");
				return Response.json(
					{ error: invalid ? "Invalid MCP token." : "Service temporarily unavailable." },
					{
						status: invalid ? 401 : 503,
						headers: {
							"Cache-Control": "no-store",
							...(invalid
								? { "WWW-Authenticate": 'Bearer realm="apple-rag-mcp", error="invalid_token"' }
								: {}),
						},
					},
				);
			}
			return response;
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
				outputSchema: searchOutputSchema,
				inputSchema: loggedToolInput(
					"search",
					SEARCH_TOOL_INPUT_SCHEMA,
					services,
					authContext,
					request,
				),
				annotations: { readOnlyHint: true, destructiveHint: false },
			},
			(args, ctx) => trackTool(searchTool.handle(args, authContext, request, ctx.mcpReq.signal)),
		);

		server.registerTool(
			TOOLS.FETCH.NAME,
			{
				description: TOOLS.FETCH.DESCRIPTION,
				outputSchema: fetchOutputSchema,
				inputSchema: loggedToolInput(
					"fetch",
					FETCH_TOOL_INPUT_SCHEMA,
					services,
					authContext,
					request,
				),
				annotations: { readOnlyHint: true, destructiveHint: false },
			},
			(args, ctx) => trackTool(fetchTool.handle(args, authContext, request, ctx.mcpReq.signal)),
		);

		return server;
	}
}
