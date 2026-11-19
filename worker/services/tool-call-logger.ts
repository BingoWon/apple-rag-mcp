import { backgroundD1Write, type WaitUntilContext } from "../services/d1-utils.js";
import type { ToolOutcome } from "../shared/tool-outcomes.js";
import type { OperationContext } from "./operation-context.js";

interface LogEntry extends OperationContext {
	userId: string;
	responseTimeMs: number;
	statusCode?: number;
	reason?: string | null;
	outcome: ToolOutcome;
	ipAddress?: string;
	countryCode?: string | null;
}
export interface SearchLogEntry extends LogEntry {
	requestedQuery: string;
	actualQuery: string;
	resultCount: number;
}
export interface FetchLogEntry extends LogEntry {
	requestedUrl: string;
	actualUrl: string;
	pageId?: string | null;
	contentSource?: string | null;
	provider?: string | null;
	upstreamStatus?: number | null;
	cacheHit?: boolean;
}

export class ToolCallLogger {
	constructor(
		private d1: D1Database,
		private ctx: WaitUntilContext,
	) {}
	logSearch(entry: SearchLogEntry): void {
		this.write("search_logs", entry, {
			requested_query: entry.requestedQuery,
			actual_query: entry.actualQuery,
			result_count: entry.resultCount,
		});
	}
	logFetch(entry: FetchLogEntry): void {
		this.write("fetch_logs", entry, {
			requested_url: entry.requestedUrl,
			actual_url: entry.actualUrl,
			page_id: entry.pageId ?? null,
			content_source: entry.contentSource ?? null,
			provider: entry.provider ?? null,
			upstream_status: entry.upstreamStatus ?? null,
			cache_hit: entry.cacheHit ? 1 : 0,
		});
	}
	logBrowse(entry: LogEntry & { requestedUrl: string; resultCount: number }): void {
		this.write("browse_logs", entry, {
			requested_url: entry.requestedUrl,
			result_count: entry.resultCount,
		});
	}
	private write(
		table: "search_logs" | "fetch_logs" | "browse_logs",
		entry: LogEntry,
		fields: Record<string, string | number | null>,
	): void {
		const values = {
			user_id: entry.userId,
			channel: entry.channel,
			credential_id: entry.credentialId ?? null,
			session_id: entry.sessionId ?? null,
			auth_method: entry.authMethod ?? null,
			request_id: entry.requestId ?? null,
			client_name: entry.clientName ?? null,
			client_version: entry.clientVersion ?? null,
			response_time_ms: entry.responseTimeMs,
			status_code: entry.statusCode ?? 200,
			error_code: entry.reason ?? null,
			outcome: entry.outcome,
			ip_address: entry.ipAddress ?? null,
			country_code: entry.countryCode ?? null,
			created_at: new Date().toISOString(),
			...fields,
		};
		backgroundD1Write(
			this.ctx,
			async () => {
				await this.d1
					.prepare(
						`INSERT INTO ${table} (${Object.keys(values).join(",")}) VALUES (${Object.keys(values)
							.map(() => "?")
							.join(",")})`,
					)
					.bind(...Object.values(values))
					.run();
			},
			table,
		);
	}
}
