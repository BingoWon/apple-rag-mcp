import type { CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod";
import { PageReadError } from "../../mcp-services/page-reader.js";
import type { FetchLogEntry } from "../../mcp-services/tool-call-logger.js";
import type { AuthContext, RateLimitResult, Services } from "../../mcp-types/index.js";
import { logger } from "../../mcp-utils/logger.js";
import { buildRateLimitMessage, extractClientInfo } from "../../mcp-utils/request-info.js";
import { isAppleUrl } from "../../shared/web-url.js";
import {
	createSuccessResult,
	createToolErrorResult,
	formatFetchResponse,
} from "../formatters/response-formatter.js";

export const FETCH_TOOL_INPUT_SCHEMA = z.object({
	url: z
		.string()
		.min(1)
		.max(2048)
		.describe(
			"Public HTTP(S) page URL. Apple documentation and videos are served from the index when available; other readable pages are retrieved on demand.",
		),
});
export type FetchToolArgs = z.infer<typeof FETCH_TOOL_INPUT_SCHEMA>;

export class FetchTool {
	constructor(private services: Services) {}

	async handle(
		args: FetchToolArgs,
		authContext: AuthContext,
		httpRequest: Request,
		signal: AbortSignal = httpRequest.signal,
	): Promise<CallToolResult> {
		signal.throwIfAborted();
		const start = Date.now();
		const { ip, country } = extractClientInfo(httpRequest);
		const log = (result: Pick<FetchLogEntry, "outcome" | "statusCode"> & Partial<FetchLogEntry>) =>
			this.services.logger?.logFetch({
				userId: authContext.userId || `anon_${ip}`,
				mcpToken: authContext.token ?? null,
				requestedUrl: args.url,
				actualUrl: args.url,
				ipAddress: ip,
				countryCode: country,
				responseTimeMs: Date.now() - start,
				...result,
			});
		let quota: RateLimitResult | undefined;
		try {
			quota = await this.services.rateLimit.checkLimits(ip, authContext);
			signal.throwIfAborted();
			if (!quota.allowed) {
				log({ outcome: "limited", statusCode: 429, reason: "RATE_LIMIT_EXCEEDED" });
				return createToolErrorResult(buildRateLimitMessage(quota, authContext));
			}
			const page = await this.services.pages.getPage(args.url, signal);
			signal.throwIfAborted();
			const response = formatFetchResponse(page, authContext.isAuthenticated);
			log({
				outcome: page.provider === "index" ? "success" : "degraded",
				statusCode: 200,
				reason: page.provider === "index" ? null : "LIVE_READ_FALLBACK",
				actualUrl: page.url,
				pageId: page.pageId,
				contentSource: page.source,
				provider: page.provider,
				upstreamStatus: page.provider === "index" ? null : page.status,
				cacheHit: page.cacheHit,
			});
			return createSuccessResult(response);
		} catch (error) {
			if (quota?.allowed) await this.services.rateLimit.refund(quota);
			signal.throwIfAborted();
			if (error instanceof PageReadError) {
				log({
					outcome: error.outcome,
					statusCode: error.status,
					reason: error.reason,
					actualUrl: error.url ?? args.url,
					provider: error.provider,
					upstreamStatus: error.upstreamStatus,
					cacheHit: error.cacheHit,
					contentSource: error.url ? (isAppleUrl(error.url) ? "apple" : "third_party") : null,
				});
				return createToolErrorResult(error.message);
			}
			log({ outcome: "failed", statusCode: 500, reason: "FETCH_FAILED" });
			logger.error(
				`Page reading failed: ${error instanceof Error ? error.message : String(error)}`,
			);
			return createToolErrorResult("Failed to retrieve the page. Please retry.");
		}
	}
}
