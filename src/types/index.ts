import type { ToolChannel } from "../../worker/shared/tool-channels";
import type { ToolOutcome } from "../../worker/shared/tool-outcomes";
export interface User {
	id: string;
	email: string;
	name?: string;
	avatar?: string;
	tier: "free" | "pro" | "enterprise";
	created_at: string;
	updated_at?: string;
	permissions?: string[];
}

export interface ApiError {
	code: string;
	message: string;
	details?: string;
	suggestion?: string;
}

export interface ApiMeta {
	timestamp: string;
	request_id?: string;
}

export interface ApiResponse<T = unknown> {
	success: boolean;
	data?: T;
	error?: ApiError;
	meta?: ApiMeta;
}

export interface LoginCredentials {
	email: string;
	password: string;
}

export interface RegisterData {
	email: string;
	password: string;
	name: string;
	terms_accepted: boolean;
}

export interface MCPToken {
	id: string;
	name: string;
	mcp_token: string;
	last_used_at?: string;
	created_at: string;
}

export interface AdminStatsQuery {
	period: "24h" | "7d" | "30d" | "custom";
	channel?: ToolChannel;
	start?: string;
	end?: string;
}

export interface AdminStatsPoint {
	date: string;
	count: number;
	success?: number;
	degraded?: number;
	no_content?: number;
	invalid?: number;
	failed?: number;
	limited?: number;
	cancelled?: number;
	unknown?: number;
	registered?: number;
	anonymous?: number;
}

export interface AdminMetricStats {
	total: number;
	points: AdminStatsPoint[];
	outcomes?: Record<ToolOutcome, number>;
	breakdown?: {
		registered: number;
		anonymous: number;
	};
}

export interface AdminBillingStats {
	history_complete: boolean;
	synced_at: string | null;
	new_subscribers: AdminMetricStats;
	renewing_subscribers: AdminMetricStats;
	receipts: Record<string, AdminMetricStats>;
}

export type ModelCostCategory = "jev" | "microsoft_decision" | "embedding" | "reranking";
export type ModelCostCurrency = "USD" | "CNY";

export interface AdminModelCosts {
	first_recorded_at: string | null;
	exchange_rate: number | null;
	categories: Record<ModelCostCategory, { attempts: number; unpriced_attempts: number }>;
	currencies: Partial<
		Record<
			ModelCostCurrency,
			{
				total_nanos: number;
				categories: Record<
					ModelCostCategory,
					{
						total_nanos: number;
						priced_attempts: number;
						points: { date: string; count: number | null }[];
					}
				>;
			}
		>
	>;
}

export interface AdminDashboardStats {
	billing: AdminBillingStats;
	model_costs: AdminModelCosts;
	channels: Record<ToolChannel, AdminMetricStats>;
	start: string;
	end: string;
	timezone: string;
	bucket: "hour" | "day";
	generated_at: string;
	metrics: Record<
		| "users"
		| "tokens"
		| "ips"
		| "searches"
		| "fetches"
		| "browses"
		| "messages"
		| "new_users"
		| "active_users"
		| "cumulative_users",
		AdminMetricStats
	>;
	subscriptions: { total: number; pro: number; enterprise: number };
}

export interface CorpusStats {
	docs_total: number;
	videos_total: number;
	chunks_total: number;
	readable_pages: number;
	indexed_pages: number;
	navigation_only_pages: number;
	embedded_percentage: number | null;
	generated_at: string;
}

export interface CurrentUsage {
	current_usage: number;
	limit: number;
	remaining: number;
	reset_at: string;
	usage_percentage: number;
}

export interface UsageLogItem {
	id: string;
	query: string | null;
	result_count: number;
	status: "success" | "error";
	response_time_ms: number | null;
	channel: "mcp" | "cli" | "unknown";
	credential_id: string | null;
	request_id: string | null;
	log_type: "search" | "fetch" | "browse";
	created_at: string;
}

export interface Subscription {
	id: string;
	plan_id: string;
	plan_name: string;
	status: "active" | "canceled" | "past_due" | "trialing" | "incomplete" | "inactive";
	current_period_start: string;
	current_period_end: string;
	cancel_at_period_end: boolean;
	weekly_quota: number;
	currency: string | null;
	price: number;
	billing_interval: string;
	payment_type?: "subscription" | "one_time";
	stripe_customer_id?: string;
}
