/**
 * Permission system types and constants
 */

// Modern subscription plan permissions mapping
export const TIER_PERMISSIONS: Record<string, string[]> = {
	hobby: ["rag:query", "stats:read"],
	pro: ["rag:query", "rag:query:advanced", "stats:read", "stats:export"],
	enterprise: [
		"rag:query",
		"rag:query:advanced",
		"stats:read",
		"stats:export",
		"admin:read",
		"admin:write",
	],
};

// OAuth quota system
interface SubscriptionQuota {
	week: number;
	minute: number;
	maxRequestsPerHour: number;
	maxTokensPerUser: number;
	canAccessPremiumFeatures: boolean;
}

export const OAUTH_SUBSCRIPTION_QUOTAS: Record<string, SubscriptionQuota> = {
	anonymous: {
		week: 30,
		minute: 3,
		maxRequestsPerHour: 50,
		maxTokensPerUser: 0,
		canAccessPremiumFeatures: false,
	},
	hobby: {
		week: 50,
		minute: 5,
		maxRequestsPerHour: 100,
		maxTokensPerUser: 3,
		canAccessPremiumFeatures: false,
	},
	pro: {
		week: 50000,
		minute: 50,
		maxRequestsPerHour: 1000,
		maxTokensPerUser: 10,
		canAccessPremiumFeatures: true,
	},
	enterprise: {
		week: -1,
		minute: -1,
		maxRequestsPerHour: 10000,
		maxTokensPerUser: 50,
		canAccessPremiumFeatures: true,
	},
};
