import { create } from "zustand";
import { trackEvent } from "@/lib/analytics";
import { api } from "@/lib/api";
import type { CurrentUsage, MCPToken, Subscription, ToolCallsStats } from "@/types";

interface DashboardState {
	// Data
	mcpTokens: MCPToken[];
	toolCallsStats: ToolCallsStats | null;
	currentUsage: CurrentUsage | null;
	subscription: Subscription | null;

	// Loading states
	isLoadingTokens: boolean;
	isLoadingUsage: boolean;
	isLoadingQuota: boolean;
	isLoadingSubscription: boolean;

	// Error states
	errors: {
		tokens: string | null;
		usage: string | null;
		quota: string | null;
		subscription: string | null;
	};

	// Actions
	fetchMCPTokens: () => Promise<boolean>;
	createMCPToken: (data: { name: string; permissions?: string[] }) => Promise<MCPToken | null>;
	updateMCPToken: (id: string, name: string) => Promise<void>;
	deleteMCPToken: (id: string) => Promise<void>;
	fetchToolCallsStats: (period?: "24h" | "7d" | "30d") => Promise<boolean>;
	fetchCurrentUsage: () => Promise<boolean>;
	fetchSubscription: () => Promise<boolean>;
	refreshDashboard: () => Promise<void>;
	clearError: (key: keyof DashboardState["errors"]) => void;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
	// Initial state
	mcpTokens: [],
	toolCallsStats: null,
	currentUsage: null,
	subscription: null,
	isLoadingTokens: false,
	isLoadingUsage: false,
	isLoadingQuota: false,
	isLoadingSubscription: false,

	// Initial error states
	errors: {
		tokens: null,
		usage: null,
		quota: null,
		subscription: null,
	},

	fetchMCPTokens: async (): Promise<boolean> => {
		set({
			isLoadingTokens: true,
			errors: { ...get().errors, tokens: null },
		});

		try {
			const response = await api.getMCPTokens();
			if (!response.success || !response.data) {
				throw new Error(response.error?.message || "Failed to fetch MCP tokens");
			}
			set({
				mcpTokens: response.data as MCPToken[],
				isLoadingTokens: false,
				errors: { ...get().errors, tokens: null },
			});
			return true;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Failed to fetch MCP tokens";
			set({
				isLoadingTokens: false,
				errors: { ...get().errors, tokens: errorMessage },
			});
			console.error("Failed to fetch MCP tokens:", error);
			return false;
		}
	},

	createMCPToken: async (data): Promise<MCPToken | null> => {
		try {
			const response = await api.createMCPToken(data);

			// Check if the response indicates an error
			if (!response.success) {
				const errorMessage = response.error?.message || "Failed to create MCP token";
				set((state) => ({
					errors: { ...state.errors, tokens: errorMessage },
				}));
				throw new Error(errorMessage);
			}

			const newToken = response.data as MCPToken;

			set((state) => ({
				mcpTokens: [newToken, ...state.mcpTokens],
				errors: { ...state.errors, tokens: null },
			}));

			// Track MCP token creation
			trackEvent("MCP_TOKEN_CREATE", {
				token_name: newToken.name,
				token_count: get().mcpTokens.length + 1,
			});

			return newToken;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Failed to create MCP token";
			set((state) => ({
				errors: { ...state.errors, tokens: errorMessage },
			}));
			console.error("Failed to create MCP token:", error);
			return null;
		}
	},

	updateMCPToken: async (id, name): Promise<void> => {
		try {
			await api.updateMCPToken(id, name);

			set((state) => ({
				mcpTokens: state.mcpTokens.map((token) => (token.id === id ? { ...token, name } : token)),
				errors: { ...state.errors, tokens: null },
			}));
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Failed to update MCP token";
			set((state) => ({
				errors: { ...state.errors, tokens: errorMessage },
			}));
			console.error("Failed to update MCP token:", error);
			throw error; // Re-throw for component error handling
		}
	},

	deleteMCPToken: async (id): Promise<void> => {
		try {
			// Get token info before deletion for tracking
			const tokenToDelete = get().mcpTokens.find((token) => token.id === id);

			await api.deleteMCPToken(id);

			set((state) => ({
				mcpTokens: state.mcpTokens.filter((token) => token.id !== id),
				errors: { ...state.errors, tokens: null },
			}));

			// Track MCP token deletion
			if (tokenToDelete) {
				trackEvent("MCP_TOKEN_DELETE", {
					token_name: tokenToDelete.name,
					token_count: get().mcpTokens.length,
				});
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Failed to delete MCP token";
			set((state) => ({
				errors: { ...state.errors, tokens: errorMessage },
			}));
			console.error("Failed to delete MCP token:", error);
			throw error; // Re-throw for component error handling
		}
	},

	fetchToolCallsStats: async (period: "24h" | "7d" | "30d" = "7d"): Promise<boolean> => {
		set({
			isLoadingUsage: true,
			errors: { ...get().errors, usage: null },
		});

		try {
			const response = await api.getUserToolCallsStats(period);

			if (response.success && response.data) {
				set({
					toolCallsStats: response.data as ToolCallsStats,
					isLoadingUsage: false,
					errors: { ...get().errors, usage: null },
				});
				return true;
			} else {
				throw new Error("Failed to fetch usage statistics");
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Failed to fetch usage statistics";
			set({
				toolCallsStats: null,
				isLoadingUsage: false,
				errors: { ...get().errors, usage: errorMessage },
			});
			return false;
		}
	},

	fetchCurrentUsage: async (): Promise<boolean> => {
		set({
			isLoadingQuota: true,
			errors: { ...get().errors, quota: null },
		});

		try {
			const response = await api.getUserQuota();

			if (response.success && response.data) {
				set({
					currentUsage: response.data as CurrentUsage,
					isLoadingQuota: false,
					errors: { ...get().errors, quota: null },
				});
				return true;
			} else {
				throw new Error("Failed to fetch current usage");
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Failed to fetch current usage";
			console.error("Failed to fetch current usage:", error);
			set({
				currentUsage: null,
				isLoadingQuota: false,
				errors: { ...get().errors, quota: errorMessage },
			});
			return false;
		}
	},

	fetchSubscription: async (): Promise<boolean> => {
		set({
			isLoadingSubscription: true,
			errors: { ...get().errors, subscription: null },
		});

		try {
			const response = await api.getUserSubscription();
			if (!response.success || !response.data) {
				throw new Error(response.error?.message || "Failed to fetch subscription");
			}
			set({
				subscription: response.data as Subscription,
				isLoadingSubscription: false,
				errors: { ...get().errors, subscription: null },
			});
			return true;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Failed to fetch subscription";
			console.error("Failed to fetch subscription:", error);
			set({
				isLoadingSubscription: false,
				errors: { ...get().errors, subscription: errorMessage },
			});
			return false;
		}
	},

	refreshDashboard: async () => {
		const { fetchMCPTokens, fetchToolCallsStats, fetchCurrentUsage } = get();

		try {
			await Promise.allSettled([fetchMCPTokens(), fetchToolCallsStats(), fetchCurrentUsage()]);
		} catch (error) {
			console.warn("Some dashboard data failed to load:", error);
		}
	},

	// Clear error method
	clearError: (key: keyof DashboardState["errors"]) => {
		set((state) => ({
			errors: { ...state.errors, [key]: null },
		}));
	},
}));
