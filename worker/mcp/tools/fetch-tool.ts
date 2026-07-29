import type { CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { AuthContext, Services } from "../../mcp-types/index.js";
import { logger } from "../../mcp-utils/logger.js";
import { buildRateLimitMessage, extractClientInfo } from "../../mcp-utils/request-info.js";
import { validateAndNormalizeUrl } from "../../mcp-utils/url-processor.js";
import {
	createSuccessResult,
	createToolErrorResult,
	formatFetchResponse,
} from "../formatters/response-formatter.js";

export const FETCH_TOOL_INPUT_SCHEMA = z.object({
	url: z
		.string()
		.min(1)
		.describe("URL of the Apple developer documentation or video to retrieve content for"),
});

export type FetchToolArgs = z.infer<typeof FETCH_TOOL_INPUT_SCHEMA>;

export class FetchTool {
	constructor(private services: Services) {}

	async handle(
		args: FetchToolArgs,
		authContext: AuthContext,
		httpRequest: Request,
	): Promise<CallToolResult> {
		const startTime = Date.now();
		const { url } = args;

		const { ip: ipAddress, country: countryCode } = extractClientInfo(httpRequest);

		const rateLimitResult = await this.services.rateLimit.checkLimits(ipAddress, authContext);

		if (!rateLimitResult.allowed) {
			this.logFetch(
				authContext,
				url,
				url,
				"",
				0,
				ipAddress,
				countryCode,
				429,
				"RATE_LIMIT_EXCEEDED",
			);

			return createToolErrorResult(buildRateLimitMessage(rateLimitResult, authContext));
		}

		try {
			// Validate and normalize URL
			const urlResult = validateAndNormalizeUrl(url);
			if (!urlResult.isValid) {
				logger.warn(`Invalid URL provided: ${url} - ${urlResult.error}`);

				return createToolErrorResult(`Invalid URL: ${urlResult.error}`);
			}

			// Use normalized URL for database lookup
			const processedUrl = urlResult.normalizedUrl;
			const page = await this.services.database.getPageByUrl(processedUrl);
			const responseTime = Date.now() - startTime;

			if (!page) {
				this.logFetch(
					authContext,
					url,
					processedUrl,
					"",
					responseTime,
					ipAddress,
					countryCode,
					404,
					"NOT_FOUND",
				);

				return createToolErrorResult(`No content found for URL: ${url}`);
			}

			this.logFetch(authContext, url, processedUrl, page.id, responseTime, ipAddress, countryCode);

			// Format response with professional styling
			const formattedContent = formatFetchResponse(
				{
					success: true,
					title: page.title || undefined,
					content: page.content,
				},
				authContext.isAuthenticated,
			);

			return createSuccessResult(formattedContent);
		} catch (error) {
			this.logFetch(
				authContext,
				url,
				url,
				"",
				Date.now() - startTime,
				ipAddress,
				countryCode,
				500,
				"FETCH_FAILED",
			);

			logger.error(
				`Fetch failed for URL ${url}: ${error instanceof Error ? error.message : String(error)}`,
			);

			return createToolErrorResult("Failed to fetch content from the specified URL");
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
		errorCode?: string,
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
