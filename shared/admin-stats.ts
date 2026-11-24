import type { ToolChannel } from "./tool-channels.js";
import type { ToolOutcome } from "./tool-outcomes.js";

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
