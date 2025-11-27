/**
 * Fetch Tool Handler
 * Handles MCP fetch tool requests for content retrieval
 */

import type { AuthContext, MCPResponse, Services } from "../../types/index.js";
import { logger } from "../../utils/logger.js";
import {
  buildRateLimitMessage,
  extractClientInfo,
} from "../../utils/request-info.js";
import { validateAndNormalizeUrl } from "../../utils/url-processor.js";
import {
  createErrorResponse,
  createSuccessResponse,
  formatFetchResponse,
} from "../formatters/response-formatter.js";
import { MCP_ERROR_CODES } from "../protocol-handler.js";

export interface FetchToolArgs {
  url: string;
}

export class FetchTool {
  constructor(private services: Services) {}

  /**
   * Handle fetch tool request
   */
  async handle(
    id: string | number,
    args: FetchToolArgs,
    authContext: AuthContext,
    httpRequest: Request
  ): Promise<MCPResponse> {
    const startTime = Date.now();
    const { url } = args;

    // Validate URL parameter
    if (!url || typeof url !== "string" || url.trim().length === 0) {
      return createErrorResponse(
        id,
        MCP_ERROR_CODES.INVALID_PARAMS,
        "URL parameter is required and must be a valid string"
      );
    }

    const { ip: ipAddress, country: countryCode } =
      extractClientInfo(httpRequest);

    const rateLimitResult = await this.services.rateLimit.checkLimits(
      ipAddress,
      authContext
    );

    if (!rateLimitResult.allowed) {
      this.logFetch(authContext, url, url, "", 0, ipAddress, countryCode, 429, "RATE_LIMIT_EXCEEDED");

      return createErrorResponse(
        id,
        MCP_ERROR_CODES.RATE_LIMIT_EXCEEDED,
        buildRateLimitMessage(rateLimitResult, authContext)
      );
    }

    try {
      // Validate and normalize URL
      const urlResult = validateAndNormalizeUrl(url);
      if (!urlResult.isValid) {
        logger.warn(`Invalid URL provided: ${url} - ${urlResult.error}`);

        return createErrorResponse(
          id,
          MCP_ERROR_CODES.INVALID_PARAMS,
          `Invalid URL: ${urlResult.error}`
        );
      }

      // Use normalized URL for database lookup
      const processedUrl = urlResult.normalizedUrl;
      const page = await this.services.database.getPageByUrl(processedUrl);
      const responseTime = Date.now() - startTime;

      if (!page) {
        this.logFetch(authContext, url, processedUrl, "", responseTime, ipAddress, countryCode, 404, "NOT_FOUND");

        return createErrorResponse(
          id,
          MCP_ERROR_CODES.INVALID_PARAMS,
          `No content found for URL: ${url}`
        );
      }

      this.logFetch(authContext, url, processedUrl, page.id, responseTime, ipAddress, countryCode);

      // Format response with professional styling
      const formattedContent = formatFetchResponse(
        {
          success: true,
          title: page.title || undefined,
          content: page.content,
        },
        authContext.isAuthenticated
      );

      return createSuccessResponse(id, formattedContent);
    } catch (error) {
      this.logFetch(authContext, url, url, "", Date.now() - startTime, ipAddress, countryCode, 500, "FETCH_FAILED");

      logger.error(
        `Fetch failed for URL ${url}: ${error instanceof Error ? error.message : String(error)}`
      );

      return createErrorResponse(
        id,
        MCP_ERROR_CODES.INTERNAL_ERROR,
        "Failed to fetch content from the specified URL"
      );
    }
  }

  private logFetch(
    authContext: AuthContext,
    requestedUrl: string,
    actualUrl: string,
    pageId: string,
    responseTime: number,
    ipAddress: string,
    countryCode: string | null,
    statusCode = 200,
    errorCode?: string
  ): void {
    this.services.logger?.logFetch({
      userId: authContext.userId || `anon_${ipAddress}`,
      requestedUrl,
      actualUrl,
      pageId,
      responseTimeMs: responseTime,
      ipAddress,
      countryCode,
      statusCode,
      errorCode,
      mcpToken: authContext.token || null,
    });
  }
}
