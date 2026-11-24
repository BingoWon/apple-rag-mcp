import {
	type CallToolResult,
	createMcpHandler,
	McpServer,
	preloadSchemas,
} from "@modelcontextprotocol/server";
import { browseInputSchema } from "../../shared/browse.js";
import {
	browseSuccessSchema,
	fetchInputSchema,
	fetchSuccessSchema,
	searchInputSchema,
	searchSuccessSchema,
} from "../../shared/contracts.js";
import { MCPAuthenticationError } from "../mcp-auth/auth-middleware.js";
import type { AuthContext, Services } from "../services/types.js";
import { logger } from "../shared/logger.js";
import { SERVER_NAME, SERVER_TITLE, SERVER_VERSION, TOOLS } from "./constants.js";
import { loggedToolInput } from "./tool-input.js";
import { executeMcpTool } from "./tools.js";

preloadSchemas();

const SERVER_INSTRUCTIONS =
	"Choose the tool that answers the task. Use search for a specific Apple API or WWDC question, browse to explore indexed topics, or fetch to read a known URL directly. Cite the source when the retrieved evidence answers the question.";

export class MCPProtocolHandler {
	constructor(
		private servicesFactory: () => Services | Promise<Services>,
		private authenticate: (request: Request) => Promise<AuthContext>,
	) {}

	async handleRequest(request: Request): Promise<Response> {
		let services: Services | undefined;
		const activeToolCalls = new Set<Promise<CallToolResult>>();
		let authFailure: Error | undefined;
		const trackTool = (promise: Promise<CallToolResult>) => {
			activeToolCalls.add(promise);
			promise.finally(() => activeToolCalls.delete(promise)).catch(() => {});
			return promise;
		};
		const handler = createMcpHandler(
			async () => {
				try {
					const authContext = await this.authenticate(request);
					services = await this.servicesFactory();
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
			// Wait for all in-flight tool calls (including legacy batches) to finish cleanup/refunds.
			if (activeToolCalls.size > 0) await Promise.allSettled([...activeToolCalls]);
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
				title: SERVER_TITLE,
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

		server.registerTool(
			TOOLS.SEARCH.NAME,
			{
				title: TOOLS.SEARCH.TITLE,
				description: TOOLS.SEARCH.DESCRIPTION,
				inputSchema: loggedToolInput("search", searchInputSchema, services, authContext, request),
				outputSchema: searchSuccessSchema,
				annotations: {
					readOnlyHint: true,
					destructiveHint: false,
					idempotentHint: true,
					openWorldHint: false,
				},
			},
			(args, ctx) =>
				trackTool(
					executeMcpTool("search", args, services, authContext, request, ctx.mcpReq.signal),
				),
		);

		server.registerTool(
			TOOLS.BROWSE.NAME,
			{
				title: TOOLS.BROWSE.TITLE,
				description: TOOLS.BROWSE.DESCRIPTION,
				inputSchema: loggedToolInput("browse", browseInputSchema, services, authContext, request),
				outputSchema: browseSuccessSchema,
				annotations: {
					readOnlyHint: true,
					destructiveHint: false,
					idempotentHint: true,
					openWorldHint: false,
				},
			},
			(args, ctx) =>
				trackTool(
					executeMcpTool("browse", args, services, authContext, request, ctx.mcpReq.signal),
				),
		);

		server.registerTool(
			TOOLS.FETCH.NAME,
			{
				title: TOOLS.FETCH.TITLE,
				description: TOOLS.FETCH.DESCRIPTION,
				inputSchema: loggedToolInput("fetch", fetchInputSchema, services, authContext, request),
				outputSchema: fetchSuccessSchema,
				annotations: {
					readOnlyHint: true,
					destructiveHint: false,
					idempotentHint: true,
					openWorldHint: true,
				},
			},
			(args, ctx) =>
				trackTool(executeMcpTool("fetch", args, services, authContext, request, ctx.mcpReq.signal)),
		);
		return server;
	}
}
