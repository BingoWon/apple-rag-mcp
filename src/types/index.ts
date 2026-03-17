// User types
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

// API types
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

// Auth types
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

export interface AuthResponse {
	user: User;
	token: string;
	expires_at: string;
}

// MCP Token types
export interface MCPToken {
	id: string;
	name: string;
	mcp_token: string; // Complete token - now available in list for user convenience
	last_used_at?: string;
	created_at: string;
}

// Tool Calls types
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

// Note: Subscription and pricing types removed - not supported by backend

// Component types
export interface ButtonProps {
	variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
	size?: "default" | "sm" | "lg" | "icon";
	children: React.ReactNode;
	className?: string;
	disabled?: boolean;
	loading?: boolean;
}

export interface InputProps {
	label?: string;
	error?: string;
	helperText?: string;
	required?: boolean;
}

// Navigation types
export interface NavItem {
	name: string;
	href: string;
	icon?: React.ComponentType<{ className?: string }>;
	current?: boolean;
}

// Chart types
export interface ChartDataPoint {
	date: string;
	value: number;
	label?: string;
}

export interface ChartProps {
	data: ChartDataPoint[];
	height?: number;
	color?: string;
	showGrid?: boolean;
	showTooltip?: boolean;
}

// User quota types
export interface UserQuota {
	current_usage: number;
	limit: number;
	remaining: number;
	reset_at: string;
	usage_percentage: number;
}

// MCP Usage Log types
export interface UsageLogItem {
	id: string;
	query: string | null;
	result_count: number;
	status: "success" | "error";
	response_time_ms: number;
	mcp_token: string | null;
	created_at: string;
}

// Note: Use PaginatedResponse<UsageLogItem> for paginated usage logs

// Pricing and billing types
export interface PricingPlan {
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

export interface RAGQueryResult {
	id: string;
	content: string;
	source: string;
	relevance_score: number;
	metadata?: Record<string, unknown>;
}

export interface RAGQueryResponse {
	query: string;
	results: RAGQueryResult[];
	total_results: number;
	response_time: number;
	query_id: string;
}

// Pagination types
export interface PaginationInfo {
	page: number;
	limit: number;
	total: number;
	has_next: boolean;
	has_prev: boolean;
}

export interface PaginatedResponse<T> {
	items: T[];
	pagination: PaginationInfo;
}

// Admin types
export interface AdminTokensResponse {
	tokens: MCPToken[];
	total: number;
}

export interface AdminUsageLogsResponse {
	logs: UsageLogItem[];
	total: number;
}

export interface AdminUsersResponse {
	users: User[];
	total: number;
}

export interface AdminSubscriptionsResponse {
	subscriptions: Subscription[];
	total: number;
}

// Auth response types
export interface AuthUrlResponse {
	auth_url: string;
}

// Additional auth types for store compatibility
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
