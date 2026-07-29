import type { CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { AuthContext, Services } from "../../mcp-types/index.js";
import { logger } from "../../mcp-utils/logger.js";
import { cleanQuerySafely } from "../../mcp-utils/query-cleaner.js";
import { buildRateLimitMessage, extractClientInfo } from "../../mcp-utils/request-info.js";
import { MESSAGES } from "../constants.js";
import {
	createSuccessResult,
	createToolErrorResult,
	formatRAGResponse,
} from "../formatters/response-formatter.js";

export const SEARCH_TOOL_INPUT_SCHEMA = z.object({
	query: z
		.string()
		.min(1)
		.max(10000)
		.describe(
			"Search query for Apple's official developer documentation and video content. Queries must be written in English and focus on technical concepts, APIs, frameworks, features, and version numbers rather than temporal information.",
		),
	result_count: z
		.number()
		.int()
		.min(1)
		.max(10)
		.optional()
		.default(4)
		.describe("Number of results to return (1-10)"),
});

export type SearchToolArgs = z.infer<typeof SEARCH_TOOL_INPUT_SCHEMA>;

export class SearchTool {
	constructor(private services: Services) {}

	async handle(
		args: SearchToolArgs,
		authContext: AuthContext,
		httpRequest: Request,
	): Promise<CallToolResult> {
		const startTime = Date.now();
		const { query, result_count = 4 } = args;

		const requestedQuery = query;
		const actualQuery = cleanQuerySafely(query);

		if (actualQuery !== requestedQuery) {
			logger.info(`Query cleaned: "${requestedQuery}" -> "${actualQuery}"`);
		}

		try {
			const { ip: clientIP, country: countryCode } = extractClientInfo(httpRequest);
			const rateLimitResult = await this.services.rateLimit.checkLimits(clientIP, authContext);

			if (!rateLimitResult.allowed) {
				this.logSearch(
					authContext,
					requestedQuery,
					actualQuery,
					{ count: 0 },
					0,
					clientIP,
					countryCode,
					429,
					"RATE_LIMIT_EXCEEDED",
				);

				return createToolErrorResult(buildRateLimitMessage(rateLimitResult, authContext));
			}

			const ragResult = await this.processQuery(
				requestedQuery,
				actualQuery,
				result_count,
				authContext,
				clientIP,
				countryCode,
				startTime,
			);

			const formattedResponse = formatRAGResponse(ragResult, authContext.isAuthenticated);

			return createSuccessResult(formattedResponse);
		} catch (error) {
			logger.error(
				`RAG query failed for "${actualQuery}": ${error instanceof Error ? error.message : String(error)}`,
			);

			return createToolErrorResult(MESSAGES.SEARCH_FAILED);
		}
	}

	private async processQuery(
		requestedQuery: string,
		actualQuery: string,
		resultCount: number,
		authContext: AuthContext,
		ipAddress: string,
		countryCode: string | null,
		startTime: number,
	) {
		const ragResult = await this.services.rag.query({
			query: actualQuery,
			result_count: resultCount,
		});

		this.logSearch(
			authContext,
			requestedQuery,
			actualQuery,
			ragResult,
			Date.now() - startTime,
			ipAddress,
			countryCode,
		);

		return ragResult;
	}

	private logSearch(
		authContext: AuthContext,
		requestedQuery: string,
		actualQuery: string,
		ragResult: { count?: number },
		responseTime: number,
		ipAddress: string,
		countryCode: string | null,
		statusCode = 200,
		errorCode?: string,
	): void {
		this.services.logger?.logSearch({
			userId: authContext.userId || `anon_${ipAddress}`,
			requestedQuery,
			actualQuery,
			resultCount: ragResult?.count || 0,
			responseTimeMs: responseTime,
			ipAddress,
			countryCode,
			statusCode,
			errorCode,
			mcpToken: authContext.token || null,
		});
	}
}
