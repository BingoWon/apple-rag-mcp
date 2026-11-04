import {
	type FetchOutput,
	fetchInputSchema,
	type SearchOutput,
	searchInputSchema,
	type ToolError,
} from "../../shared/contracts.js";
import { cleanQuerySafely } from "../services/query-cleaner.js";
import { buildRateLimitMessage, extractClientInfo } from "../services/request-info.js";
import { isAppleUrl } from "../shared/web-url.js";
import { accountStatus } from "./account.js";
import { operationContext } from "./operation-context.js";
import { PageReadError } from "./page-reader.js";
import type { FetchLogEntry, SearchLogEntry } from "./tool-call-logger.js";
import { fetchOutput, searchOutput } from "./tool-results.js";
import type { AuthContext, RateLimitResult, Services } from "./types.js";

type Operation = "search" | "fetch";
export class ToolService {
	constructor(private services: Services) {}

	execute(
		name: "search",
		input: unknown,
		auth: AuthContext,
		request: Request,
		channel: "mcp" | "cli",
		signal?: AbortSignal,
	): Promise<SearchOutput>;
	execute(
		name: "fetch",
		input: unknown,
		auth: AuthContext,
		request: Request,
		channel: "mcp" | "cli",
		signal?: AbortSignal,
	): Promise<FetchOutput>;
	async execute(
		name: Operation,
		input: unknown,
		auth: AuthContext,
		request: Request,
		channel: "mcp" | "cli",
		signal = request.signal,
	): Promise<SearchOutput | FetchOutput> {
		const parsed = (name === "search" ? searchInputSchema : fetchInputSchema).safeParse(input);
		if (!parsed.success)
			return rejectOperation(this.services.logger, name, input, auth, request, channel);
		const data = parsed.data;
		const start = Date.now();
		const context = operationContext(auth, request, channel);
		const { ip } = extractClientInfo(request);
		const actualQuery = "query" in data ? cleanQuerySafely(data.query) : undefined;
		const log = (
			details: Partial<SearchLogEntry & FetchLogEntry> & { outcome: SearchLogEntry["outcome"] },
		) =>
			logOperation(this.services.logger, name, input, auth, request, {
				...context,
				responseTimeMs: Date.now() - start,
				...details,
				actualQuery,
			});
		let quota: RateLimitResult | undefined;
		try {
			signal.throwIfAborted();
			quota = await this.services.rateLimit.checkLimits(ip, auth);
			signal.throwIfAborted();
			if (!quota.allowed) {
				log({ outcome: "limited", statusCode: 429, reason: "RATE_LIMIT_EXCEEDED" });
				return {
					ok: false,
					request_id: context.requestId,
					account: accountStatus(auth, quota, channel),
					outcome: "limited",
					error: {
						code: "RATE_LIMIT_EXCEEDED",
						message: buildRateLimitMessage(quota, auth, channel),
						status: 429,
						retry_at: quota.limitType === "minute" ? quota.minuteResetAt : quota.resetAt,
					},
				};
			}
			let result: SearchOutput | FetchOutput;
			if ("query" in data) {
				const rag = await this.services.rag.query({
					query: actualQuery!,
					result_count: data.result_count,
					signal,
				});
				signal.throwIfAborted();
				result = searchOutput(rag, accountStatus(auth, quota, channel));
				log({
					outcome: result.outcome,
					statusCode: 200,
					resultCount: rag.count,
					reason: rag.degradations.join(",") || null,
				});
			} else {
				const page = await this.services.pages.getPage(data.url, signal);
				signal.throwIfAborted();
				result = fetchOutput(data.url, page, accountStatus(auth, quota, channel));
				log({
					outcome: result.outcome,
					statusCode: 200,
					reason: page.provider === "index" ? null : "LIVE_READ_FALLBACK",
					actualUrl: page.url,
					pageId: page.pageId,
					contentSource: page.source,
					provider: page.provider,
					upstreamStatus: page.provider === "index" ? null : page.status,
					cacheHit: page.cacheHit,
				});
			}
			return { ...result, request_id: context.requestId };
		} catch (error) {
			if (quota?.allowed) await this.services.rateLimit.refund(quota);
			if (signal.aborted) {
				log({ outcome: "cancelled", statusCode: 499, reason: "REQUEST_CANCELLED" });
				signal.throwIfAborted();
			}
			if (error instanceof PageReadError) {
				const source = error.url ? (isAppleUrl(error.url) ? "apple" : "third_party") : undefined;
				log({
					outcome: error.outcome,
					statusCode: error.status,
					reason: error.reason,
					actualUrl: error.url,
					provider: error.provider,
					upstreamStatus: error.upstreamStatus,
					cacheHit: error.cacheHit,
					contentSource: source,
				});
				return {
					ok: false,
					request_id: context.requestId,
					outcome: error.outcome,
					error: { code: error.reason, message: error.message, status: error.status },
					url: error.url,
					source,
					provider: error.provider,
					upstream_status: error.upstreamStatus,
					cache_hit: error.cacheHit,
				};
			}
			const code = name === "search" ? "SEARCH_FAILED" : "FETCH_FAILED";
			log({ outcome: "failed", statusCode: 500, reason: code });
			console.error(`${name} failed: ${error instanceof Error ? error.name : "unknown error"}`);
			return {
				ok: false,
				request_id: context.requestId,
				outcome: "failed",
				error: {
					code,
					message: `Failed to ${name === "search" ? "search documentation" : "retrieve the page"}. Please retry.`,
					status: 500,
				},
			};
		}
	}
}

function logOperation(
	logger: Services["logger"],
	name: Operation,
	input: unknown,
	auth: AuthContext,
	request: Request,
	details: Partial<SearchLogEntry & FetchLogEntry> &
		Pick<SearchLogEntry, "outcome" | "responseTimeMs" | "channel" | "authMethod" | "requestId">,
): void {
	const { ip, country } = extractClientInfo(request);
	const value = input && typeof input === "object" ? input : {};
	const common = {
		userId: auth.userId || `anon_${ip}`,
		ipAddress: ip,
		countryCode: country,
		...details,
	};
	if (name === "search") {
		const query =
			"query" in value && typeof value.query === "string" ? value.query.slice(0, 10000) : "";
		logger?.logSearch({
			...common,
			requestedQuery: query,
			actualQuery: details.actualQuery ?? query,
			resultCount: details.resultCount ?? 0,
		});
	} else {
		const url = "url" in value && typeof value.url === "string" ? value.url.slice(0, 2048) : "";
		logger?.logFetch({
			...common,
			requestedUrl: url,
			actualUrl: details.actualUrl ?? url,
		});
	}
}

export function rejectOperation(
	logger: Services["logger"],
	name: Operation,
	input: unknown,
	auth: AuthContext,
	request: Request,
	channel: "mcp" | "cli",
	code = "INVALID_ARGUMENTS",
	message = "Invalid tool arguments.",
	status = 400,
): ToolError {
	const context = operationContext(auth, request, channel);
	logOperation(logger, name, input, auth, request, {
		...context,
		outcome: "invalid",
		statusCode: status,
		reason: code,
		responseTimeMs: 0,
	});
	return {
		ok: false,
		request_id: context.requestId,
		outcome: "invalid",
		error: { code, message, status },
	};
}
