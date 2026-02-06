/**
 * Search Tool Handler
 * Handles MCP search tool requests with RAG processing
 */

import type { AuthContext, MCPResponse, Services } from "../../types/index.js";
import { logger } from "../../utils/logger.js";
import { cleanQuerySafely } from "../../utils/query-cleaner.js";
import {
  buildRateLimitMessage,
  extractClientInfo,
} from "../../utils/request-info.js";
import {
  createErrorResponse,
  createSuccessResponse,
  createToolErrorResponse,
  formatRAGResponse,
} from "../formatters/response-formatter.js";
import { APP_CONSTANTS, MCP_ERROR_CODES } from "../protocol-handler.js";

export interface SearchToolArgs {
  query: string;
  result_count?: number;
}

export class SearchTool {
  constructor(private services: Services) {}

  /**
   * Handle search tool request
   */
  async handle(
    id: string | number,
    args: SearchToolArgs,
    authContext: AuthContext,
    httpRequest: Request
  ): Promise<MCPResponse> {
    const startTime = Date.now();
    let { query, result_count = 4 } = args;

    // Validate query parameter
    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return createToolErrorResponse(id, APP_CONSTANTS.MISSING_SEARCH_ERROR);
    }

    const requestedQuery = query;
    const actualQuery = cleanQuerySafely(query);

    if (actualQuery !== requestedQuery) {
      logger.info(`Query cleaned: "${requestedQuery}" -> "${actualQuery}"`);
    }

    // Validate and clamp result_count parameter
    let adjustedResultCount = result_count;
    let wasAdjusted = false;

    if (typeof result_count !== "number") {
      adjustedResultCount = 4; // Default value
      wasAdjusted = true;
    } else if (result_count < 1) {
      adjustedResultCount = 1;
      wasAdjusted = true;
    } else if (result_count > 10) {
      adjustedResultCount = 10;
      wasAdjusted = true;
    }

    // Update result_count for processing
    result_count = adjustedResultCount;

    try {
      const { ip: clientIP, country: countryCode } =
        extractClientInfo(httpRequest);
      const rateLimitResult = await this.services.rateLimit.checkLimits(
        clientIP,
        authContext
      );

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
          "RATE_LIMIT_EXCEEDED"
        );

        return createErrorResponse(
          id,
          MCP_ERROR_CODES.RATE_LIMIT_EXCEEDED,
          buildRateLimitMessage(rateLimitResult, authContext)
        );
      }

      const ragResult = await this.processQuery(
        requestedQuery,
        actualQuery,
        result_count,
        authContext,
        clientIP,
        countryCode,
        startTime
      );

      const formattedResponse = formatRAGResponse(
        ragResult,
        authContext.isAuthenticated,
        wasAdjusted
      );

      return createSuccessResponse(id, formattedResponse);
    } catch (error) {
      logger.error(
        `RAG query failed for "${actualQuery}": ${error instanceof Error ? error.message : String(error)}`
      );

      return createToolErrorResponse(id, APP_CONSTANTS.SEARCH_FAILED_ERROR);
    }
  }

  private async processQuery(
    requestedQuery: string,
    actualQuery: string,
    resultCount: number,
    authContext: AuthContext,
    ipAddress: string,
    countryCode: string | null,
    startTime: number
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
      countryCode
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
    errorCode?: string
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
