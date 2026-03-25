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

interface SubscriptionQuota {
	week: number;
	minute: number;
}

export const OAUTH_SUBSCRIPTION_QUOTAS: Record<string, SubscriptionQuota> = {
	anonymous: { week: 30, minute: 3 },
	hobby: { week: 50, minute: 5 },
	pro: { week: 50000, minute: 50 },
	enterprise: { week: -1, minute: -1 },
};
