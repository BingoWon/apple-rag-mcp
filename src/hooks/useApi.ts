import useSWR, { type SWRConfiguration } from "swr";
import { api } from "@/lib/api";

// Generic fetcher
const fetcher = async (url: string) => {
	const response = await api.get(url);
	if (!response.success) {
		throw new Error(response.error?.message || "API request failed");
	}
	return response.data;
};

// Custom hooks
export function useMCPTokens(config?: SWRConfiguration) {
	return useSWR("/mcp-tokens", fetcher, {
		revalidateOnFocus: false,
		...config,
	});
}

export function useUsageStats(period: "24h" | "7d" | "30d" = "7d", config?: SWRConfiguration) {
	return useSWR(`/usage/stats?period=${period}`, fetcher, {
		revalidateOnFocus: false,
		refreshInterval: 60000, // Refresh every minute
		...config,
	});
}

export function useSubscription(config?: SWRConfiguration) {
	return useSWR("/subscription", fetcher, {
		revalidateOnFocus: false,
		...config,
	});
}

export function useUser(config?: SWRConfiguration) {
	return useSWR("/auth/me", fetcher, {
		revalidateOnFocus: false,
		...config,
	});
}
