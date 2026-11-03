import type { ToolOutcome } from "../../worker/shared/tool-outcomes";
export type AdminLogKind = "search" | "fetch";
export interface AdminLog {
	id: string;
	user_id: string;
	channel: "unknown" | "mcp" | "cli";
	credential_id: string | null;
	session_id: string | null;
	auth_method: string | null;
	request_id: string | null;
	client_name: string | null;
	client_version: string | null;
	requested_url?: string;
	actual_url?: string;
	requested_query?: string;
	actual_query?: string;
	result_count?: number;
	response_time_ms: number | null;
	status_code: number | null;
	reason: string | null;
	outcome: ToolOutcome;
	content_source?: "apple" | "third_party" | null;
	provider?: string | null;
	upstream_status?: number | null;
	cache_hit?: boolean;
	country_code: string | null;
	created_at: string;
}
export interface AdminLogFilters {
	channel?: string;
	q?: string;
	outcome?: string;
	reason?: string;
	source?: string;
	provider?: string;
	cache?: string;
	start?: string;
	end?: string;
}
export interface AdminLogsResponse {
	logs: AdminLog[];
	total: number;
	limit: number;
	offset: number;
	hasMore: boolean;
}
