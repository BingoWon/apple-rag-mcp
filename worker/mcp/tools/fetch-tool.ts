import type { CallToolResult } from "@modelcontextprotocol/server";
import type { z } from "zod";
import { fetchInputSchema } from "../../../packages/cli/src/contracts.js";
import { PageReadError } from "../../mcp-services/page-reader.js";
import type { FetchLogEntry } from "../../mcp-services/tool-call-logger.js";
import type { AuthContext, RateLimitResult, Services } from "../../mcp-types/index.js";
import { logger } from "../../mcp-utils/logger.js";
import { buildRateLimitMessage, extractClientInfo } from "../../mcp-utils/request-info.js";
import { isAppleUrl } from "../../shared/web-url.js";
import { accountStatus } from "../account.js";
import {
	createSuccessResult,
	createToolErrorResult,
	fetchOutput,
	formatFetchResponse,
} from "../formatters/response-formatter.js";

export const FETCH_TOOL_INPUT_SCHEMA = fetchInputSchema;
export type FetchToolArgs = z.infer<typeof FETCH_TOOL_INPUT_SCHEMA>;

export class FetchTool {
	constructor(private services: Services) {}

	async handle(
		args: FetchToolArgs,
		authContext: AuthContext,
		httpRequest: Request,
		signal: AbortSignal = httpRequest.signal,
	): Promise<CallToolResult> {
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
			signal.throwIfAborted();
			quota = await this.services.rateLimit.checkLimits(ip, authContext);
			signal.throwIfAborted();
			if (!quota.allowed) {
				log({ outcome: "limited", statusCode: 429, reason: "RATE_LIMIT_EXCEEDED" });
				return createToolErrorResult({
					account: accountStatus(authContext, quota),
					outcome: "limited",
					error: {
						code: "RATE_LIMIT_EXCEEDED",
						message: buildRateLimitMessage(quota, authContext),
						status: 429,
						retry_at: quota.limitType === "minute" ? quota.minuteResetAt : quota.resetAt,
					},
				});
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
			return createSuccessResult(
				response,
				fetchOutput(args.url, page, accountStatus(authContext, quota)),
			);
		} catch (error) {
			if (quota?.allowed) await this.services.rateLimit.refund(quota);
			if (signal.aborted) {
				log({ outcome: "cancelled", statusCode: 499, reason: "REQUEST_CANCELLED" });
				signal.throwIfAborted();
			}
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
				return createToolErrorResult({
					outcome: error.outcome,
					error: { code: error.reason, message: error.message, status: error.status },
					url: error.url,
					source: error.url ? (isAppleUrl(error.url) ? "apple" : "third_party") : undefined,
					provider: error.provider,
					upstream_status: error.upstreamStatus,
					cache_hit: error.cacheHit,
				});
			}
			log({ outcome: "failed", statusCode: 500, reason: "FETCH_FAILED" });
			logger.error(
				`Page reading failed: ${error instanceof Error ? error.message : String(error)}`,
			);
			return createToolErrorResult({
				outcome: "failed",
				error: {
					code: "FETCH_FAILED",
					message: "Failed to retrieve the page. Please retry.",
					status: 500,
				},
			});
		}
	}
}
