export type {
	AdminBillingStats,
	AdminDashboardStats,
	AdminMetricStats,
	AdminModelCosts,
	AdminStatsPoint,
	AdminStatsQuery,
	ModelCostCategory,
	ModelCostCurrency,
} from "../../shared/admin-stats";
export interface User {
	id: string;
	email: string;
	name?: string;
	avatar?: string;
	tier: "hobby" | "free" | "pro" | "enterprise";
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
	plan_id: "hobby" | "pro" | "enterprise";
	plan_name: string;
	subscribed_plan_id?: "hobby" | "pro" | "enterprise";
	entitlement_source?: "free" | "stripe_subscription" | "one_time_pass" | "complimentary";
	has_active_stripe_subscription?: boolean;
	can_manage_billing?: boolean;
	status: "active" | "canceled" | "past_due" | "trialing" | "incomplete" | "inactive" | "expired";
	current_period_start?: string;
	current_period_end?: string;
	cancel_at_period_end: boolean;
	weekly_quota: number;
	minute_quota?: number;
	currency: string | null;
	price: number;
	billing_interval: string;
	payment_type: "subscription" | "one_time";
	stripe_customer_id?: string;
}
