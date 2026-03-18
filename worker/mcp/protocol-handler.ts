/**
 * MCP Protocol Handler
 * Stateless JSON-RPC 2.0 handler for Streamable HTTP transport (POST-only, no SSE)
 */

import type {
	AuthContext,
	MCPNotification,
	MCPRequest,
	MCPResponse,
	Services,
	ToolDefinition,
} from "../mcp-types/index.js";
import { logger } from "../mcp-utils/logger.js";
import {
	CORS_HEADERS,
	JSON_HEADERS,
	MCP_ERROR_CODES,
	MCP_PROTOCOL_VERSION,
	MESSAGES,
	SERVER_NAME,
	SERVER_VERSION,
	TOOLS,
} from "./constants.js";
import { createErrorResponse, createToolErrorResponse } from "./formatters/response-formatter.js";
import {
	isValidMCPNotification,
	isValidMCPRequest,
	validateInitializeParams,
	validateProtocolVersion,
	validateProtocolVersionHeader,
	validateToolCallParams,
} from "./middleware/request-validator.js";
import { FetchTool, type FetchToolArgs } from "./tools/fetch-tool.js";
import { SearchTool, type SearchToolArgs } from "./tools/search-tool.js";

interface InitializeParams {
	protocolVersion?: string;
	capabilities?: Record<string, unknown>;
	clientInfo?: { name: string; version: string };
}

export class MCPProtocolHandler {
	private searchTool: SearchTool;
	private fetchTool: FetchTool;

	constructor(services: Services) {
		this.searchTool = new SearchTool(services);
		this.fetchTool = new FetchTool(services);
	}

	async handleRequest(request: Request, authContext: AuthContext): Promise<Response> {
		try {
			const contentType = request.headers.get("content-type");
			if (!contentType?.includes("application/json")) {
				return new Response(
					JSON.stringify({
						jsonrpc: "2.0",
						id: null,
						error: {
							code: MCP_ERROR_CODES.INVALID_REQUEST,
							message: "Content-Type must be application/json",
						},
					}),
					{ status: 400, headers: JSON_HEADERS },
				);
			}

			const body = (await request.json()) as MCPRequest | MCPNotification;

			// Validate MCP-Protocol-Version header (skip initialize — version is negotiated in body)
			const isInitialize = isValidMCPRequest(body) && body.method === "initialize";
			if (!isInitialize) {
				const headerValidation = validateProtocolVersionHeader(
					request.headers.get("MCP-Protocol-Version"),
				);
				if (!headerValidation.isValid) {
					return new Response(
						JSON.stringify({
							jsonrpc: "2.0",
							id: isValidMCPRequest(body) ? body.id : null,
							error: {
								code: headerValidation.error!.code,
								message: headerValidation.error!.message,
							},
						}),
						{ status: 400, headers: JSON_HEADERS },
					);
				}
			}

			if (isValidMCPRequest(body)) {
				const response = await this.processRequest(body, authContext, request);
				return new Response(JSON.stringify(response), { headers: JSON_HEADERS });
			}

			if (isValidMCPNotification(body)) {
				logger.info(`MCP notification received: ${body.method}`);
				return new Response(null, { status: 202, headers: CORS_HEADERS });
			}

			return new Response(
				JSON.stringify({
					jsonrpc: "2.0",
					id: null,
					error: {
						code: MCP_ERROR_CODES.INVALID_REQUEST,
						message: "Invalid JSON-RPC request structure",
					},
				}),
				{ status: 400, headers: JSON_HEADERS },
			);
		} catch (error) {
			logger.error(
				`MCP request processing failed: ${error instanceof Error ? error.message : String(error)}`,
			);

			return new Response(
				JSON.stringify({
					jsonrpc: "2.0",
					id: null,
					error: { code: MCP_ERROR_CODES.PARSE_ERROR, message: "Parse error" },
				}),
				{ status: 400, headers: JSON_HEADERS },
			);
		}
	}

	private async processRequest(
		request: MCPRequest,
		authContext: AuthContext,
		httpRequest: Request,
	): Promise<MCPResponse> {
		const { id, method, params } = request;

		try {
			switch (method) {
				case "initialize":
					return this.handleInitialize(id, params);
				case "tools/list":
					return this.handleToolsList(id);
				case "tools/call":
					return this.handleToolsCall(id, params, authContext, httpRequest);
				default:
					return createErrorResponse(
						id,
						MCP_ERROR_CODES.METHOD_NOT_FOUND,
						`Method not found: ${method}`,
					);
			}
		} catch (error) {
			logger.error(
				`Method execution failed for ${method}: ${error instanceof Error ? error.message : String(error)}`,
			);
			return createErrorResponse(id, MCP_ERROR_CODES.INTERNAL_ERROR, "Internal server error");
		}
	}

	private async handleInitialize(
		id: string | number,
		params: InitializeParams | undefined,
	): Promise<MCPResponse> {
		const validation = validateInitializeParams(params);
		if (!validation.isValid) {
			return createErrorResponse(id, validation.error!.code, validation.error!.message);
		}

		const versionValidation = validateProtocolVersion(params?.protocolVersion);
		if (versionValidation.warning) {
			logger.warn(versionValidation.warning);
		}

		return {
			jsonrpc: "2.0",
			id,
			result: {
				protocolVersion: MCP_PROTOCOL_VERSION,
				capabilities: { tools: {} },
				serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
			},
		};
	}

	private async handleToolsList(id: string | number): Promise<MCPResponse> {
		const tools: ToolDefinition[] = [
			{
				name: TOOLS.SEARCH.NAME,
				description: TOOLS.SEARCH.DESCRIPTION,
				inputSchema: SearchTool.INPUT_SCHEMA,
			},
			{
				name: TOOLS.FETCH.NAME,
				description: TOOLS.FETCH.DESCRIPTION,
				inputSchema: FetchTool.INPUT_SCHEMA,
			},
		];

		return { jsonrpc: "2.0", id, result: { tools } };
	}

	private async handleToolsCall(
		id: string | number,
		params: Record<string, unknown> | undefined,
		authContext: AuthContext,
		httpRequest: Request,
	): Promise<MCPResponse> {
		const validation = validateToolCallParams(params);
		if (!validation.isValid) {
			return createToolErrorResponse(id, validation.error!.message);
		}

		const toolCall = validation.toolCall!;

		switch (toolCall.name) {
			case TOOLS.SEARCH.NAME:
				return this.searchTool.handle(
					id,
					toolCall.arguments as unknown as SearchToolArgs,
					authContext,
					httpRequest,
				);
			case TOOLS.FETCH.NAME:
				return this.fetchTool.handle(
					id,
					toolCall.arguments as unknown as FetchToolArgs,
					authContext,
					httpRequest,
				);
			default:
				return createToolErrorResponse(id, `${MESSAGES.UNKNOWN_TOOL}: ${toolCall.name}`);
		}
	}
}
