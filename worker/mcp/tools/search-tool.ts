import type { CallToolResult } from "@modelcontextprotocol/server";
import type { z } from "zod";
import { searchInputSchema } from "../../../packages/cli/src/contracts.js";
import type { AuthContext, RateLimitResult, Services } from "../../mcp-types/index.js";
import { logger } from "../../mcp-utils/logger.js";
import { cleanQuerySafely } from "../../mcp-utils/query-cleaner.js";
import { buildRateLimitMessage, extractClientInfo } from "../../mcp-utils/request-info.js";
import { accountStatus } from "../account.js";
import { MESSAGES } from "../constants.js";
import {
	createSuccessResult,
	createToolErrorResult,
	formatRAGResponse,
	searchOutput,
} from "../formatters/response-formatter.js";

export const SEARCH_TOOL_INPUT_SCHEMA = searchInputSchema;

export type SearchToolArgs = z.infer<typeof SEARCH_TOOL_INPUT_SCHEMA>;

export class SearchTool {
	constructor(private services: Services) {}

	async handle(
		args: SearchToolArgs,
		authContext: AuthContext,
		httpRequest: Request,
		signal: AbortSignal = httpRequest.signal,
	): Promise<CallToolResult> {
		const startTime = Date.now();
		const { query, result_count = 4 } = args;

		const requestedQuery = query;
		const actualQuery = cleanQuerySafely(query);
		const { ip: clientIP, country: countryCode } = extractClientInfo(httpRequest);
		let rateLimitResult: RateLimitResult | undefined;

		if (actualQuery !== requestedQuery) {
			logger.info(`Query cleaned: "${requestedQuery}" -> "${actualQuery}"`);
		}

		try {
			signal.throwIfAborted();
			rateLimitResult = await this.services.rateLimit.checkLimits(clientIP, authContext);
			signal.throwIfAborted();

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

				return createToolErrorResult({
					account: accountStatus(authContext, rateLimitResult),
					outcome: "limited",
					error: {
						code: "RATE_LIMIT_EXCEEDED",
						message: buildRateLimitMessage(rateLimitResult, authContext),
						status: 429,
						retry_at:
							rateLimitResult.limitType === "minute"
								? rateLimitResult.minuteResetAt
								: rateLimitResult.resetAt,
					},
				});
			}

			const ragResult = await this.processQuery(
				requestedQuery,
				actualQuery,
				result_count,
				authContext,
				clientIP,
				countryCode,
				startTime,
				signal,
			);

			const formattedResponse = formatRAGResponse(ragResult, authContext.isAuthenticated);

			return createSuccessResult(
				formattedResponse,
				searchOutput(ragResult, accountStatus(authContext, rateLimitResult)),
			);
		} catch (error) {
			if (rateLimitResult?.allowed) {
				await this.services.rateLimit.refund(rateLimitResult);
			}
			if (signal.aborted) {
				this.logSearch(
					authContext,
					requestedQuery,
					actualQuery,
					{ count: 0 },
					Date.now() - startTime,
					clientIP,
					countryCode,
					499,
					"REQUEST_CANCELLED",
				);
				signal.throwIfAborted();
			}
			this.logSearch(
				authContext,
				requestedQuery,
				actualQuery,
				{ count: 0 },
				Date.now() - startTime,
				clientIP,
				countryCode,
				500,
				"SEARCH_FAILED",
			);

			await logger.error(
				`RAG query failed for "${actualQuery}": ${error instanceof Error ? error.message : String(error)}`,
			);

			return createToolErrorResult({
				outcome: "failed",
				error: { code: "SEARCH_FAILED", message: MESSAGES.SEARCH_FAILED, status: 500 },
			});
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
		signal: AbortSignal,
	) {
		const ragResult = await this.services.rag.query({
			query: actualQuery,
			result_count: resultCount,
			signal,
		});
		signal.throwIfAborted();

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
		ragResult: { count?: number; degradations?: string[] },
		responseTime: number,
		ipAddress: string,
		countryCode: string | null,
		statusCode = 200,
		reason?: string,
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
			reason: reason ?? (ragResult.degradations?.join(",") || null),
			outcome:
				statusCode === 499
					? "cancelled"
					: statusCode === 429
						? "limited"
						: statusCode >= 500
							? "failed"
							: ragResult.degradations?.length
								? "degraded"
								: ragResult.count
									? "success"
									: "no_content",
			mcpToken: authContext.token || null,
		});
	}
}
