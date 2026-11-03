import type { ToolOutcome } from "../shared/tool-outcomes.js";
/**
 * Tool Call Logger with background D1 writes
 */

import { backgroundD1Write, type WaitUntilContext } from "../mcp-utils/d1-utils.js";

export interface SearchLogEntry {
	userId: string;
	mcpToken?: string | null;
	requestedQuery: string;
	actualQuery: string;
	resultCount: number;
	responseTimeMs: number;
	statusCode?: number;
	reason?: string | null;
	outcome: ToolOutcome;
	ipAddress?: string;
	countryCode?: string | null;
}

export interface FetchLogEntry {
	contentSource?: string | null;
	provider?: string | null;
	upstreamStatus?: number | null;
	cacheHit?: boolean;
	userId: string;
	mcpToken?: string | null;
	requestedUrl: string;
	actualUrl: string;
	pageId?: string | null;
	responseTimeMs: number;
	statusCode?: number;
	reason?: string | null;
	outcome: ToolOutcome;
	ipAddress?: string;
	countryCode?: string | null;
}

export class ToolCallLogger {
	constructor(
		private d1: D1Database,
		private ctx: WaitUntilContext,
	) {}

	logSearch(entry: SearchLogEntry): void {
		backgroundD1Write(this.ctx, () => this.insertSearchLog(entry), "search_log");
	}

	logFetch(entry: FetchLogEntry): void {
		backgroundD1Write(this.ctx, () => this.insertFetchLog(entry), "fetch_log");
	}

	private async insertSearchLog(entry: SearchLogEntry): Promise<void> {
		await this.d1
			.prepare(
				`INSERT INTO search_logs
         (user_id, mcp_token, requested_query, actual_query, result_count, response_time_ms, status_code, error_code, outcome, ip_address, country_code, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.bind(
				entry.userId,
				entry.mcpToken ?? null,
				entry.requestedQuery,
				entry.actualQuery,
				entry.resultCount,
				entry.responseTimeMs,
				entry.statusCode ?? 200,
				entry.reason ?? null,
				entry.outcome,
				entry.ipAddress ?? null,
				entry.countryCode ?? null,
				new Date().toISOString(),
			)
			.run();
	}

	private async insertFetchLog(entry: FetchLogEntry): Promise<void> {
		await this.d1
			.prepare(
				`INSERT INTO fetch_logs
         (user_id, mcp_token, requested_url, actual_url, page_id, response_time_ms, status_code, error_code, outcome, ip_address, country_code, created_at, content_source, provider, upstream_status, cache_hit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.bind(
				entry.userId,
				entry.mcpToken ?? null,
				entry.requestedUrl,
				entry.actualUrl,
				entry.pageId ?? null,
				entry.responseTimeMs,
				entry.statusCode ?? 200,
				entry.reason ?? null,
				entry.outcome,
				entry.ipAddress ?? null,
				entry.countryCode ?? null,
				new Date().toISOString(),
				entry.contentSource ?? null,
				entry.provider ?? null,
				entry.upstreamStatus ?? null,
				entry.cacheHit ? 1 : 0,
			)
			.run();
	}
}
