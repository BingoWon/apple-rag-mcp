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

export interface ToolCallsStats {
	total_tool_calls: number;
	total_results: number;
	calls_by_day: Array<{
		date: string;
		tool_calls: number;
		results: number;
	}>;
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
	response_time_ms: number;
	mcp_token: string | null;
	created_at: string;
}

/**
 * Stripe checkout plan shape — distinct from the UI PricingPlan in types/pricing.ts
 */
export interface CheckoutPlan {
	id: string;
	name: string;
	description: string;
	price: number;
	currency: string;
	interval: "month" | "year";
	quota: number;
	features: string[];
	popular?: boolean;
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
	price: number;
	billing_interval: string;
	payment_type?: "subscription" | "one_time";
	stripe_customer_id?: string;
}

export interface AuthTokens {
	access_token?: string;
	token?: string;
	refresh_token?: string;
}

export interface AuthResponseData {
	user?: User;
	token?: string;
	tokens?: AuthTokens;
	data?: {
		user?: User;
		token?: string;
		tokens?: AuthTokens;
	};
}

export interface ExtractedAuthData {
	user: User;
	token: string;
}
