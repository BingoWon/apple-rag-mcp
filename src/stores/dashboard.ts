import { create } from "zustand";
import { api } from "@/lib/api";
import type { CurrentUsage, MCPToken, Subscription } from "@/types";

export interface UnreadReplyItem {
	id: string;
	message: string;
	admin_reply: string;
	replied_at: string;
	created_at: string;
}

interface DashboardState {
	// Data
	mcpTokens: MCPToken[];
	unreadReplies: UnreadReplyItem[];

	currentUsage: CurrentUsage | null;
	subscription: Subscription | null;

	// Loading states
	isLoadingTokens: boolean;

	isLoadingQuota: boolean;
	isLoadingSubscription: boolean;

	// Error states
	errors: {
		tokens: string | null;

		quota: string | null;
		subscription: string | null;
	};

	// Actions
	fetchMCPTokens: () => Promise<boolean>;
	createMCPToken: (data: { name: string; permissions?: string[] }) => Promise<MCPToken | null>;
	updateMCPToken: (id: string, name: string) => Promise<void>;
	deleteMCPToken: (id: string) => Promise<void>;

	fetchCurrentUsage: () => Promise<boolean>;
	fetchSubscription: () => Promise<boolean>;
	fetchUnreadReplies: () => Promise<UnreadReplyItem[]>;
	markReplyRead: (id: string) => Promise<boolean>;
}

let generation = 0;
let unreadInFlight: Promise<UnreadReplyItem[]> | null = null;

export function resetDashboard() {
	generation++;
	unreadInFlight = null;
	useDashboardStore.setState(useDashboardStore.getInitialState(), true);
}
export const useDashboardStore = create<DashboardState>((set, get) => ({
	// Initial state
	mcpTokens: [],
	unreadReplies: [],

	currentUsage: null,
	subscription: null,
	isLoadingTokens: false,

	isLoadingQuota: false,
	isLoadingSubscription: false,

	// Initial error states
	errors: {
		tokens: null,

		quota: null,
		subscription: null,
	},

	fetchMCPTokens: async (): Promise<boolean> => {
		const owner = generation;
		set({
			isLoadingTokens: true,
			errors: { ...get().errors, tokens: null },
		});

		try {
			const response = await api.getMCPTokens();
			if (owner !== generation) return false;
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
			if (owner !== generation) return false;
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
		const owner = generation;
		try {
			const response = await api.createMCPToken(data);
			if (owner !== generation) return null;

			if (!response.success || !response.data)
				throw Error(response.error?.message ?? "Failed to create MCP token");
			const newToken = response.data as MCPToken;

			set((state) => ({
				mcpTokens: [newToken, ...state.mcpTokens],
				errors: { ...state.errors, tokens: null },
			}));

			return newToken;
		} catch (error) {
			if (owner !== generation) return null;
			const errorMessage = error instanceof Error ? error.message : "Failed to create MCP token";
			set((state) => ({
				errors: { ...state.errors, tokens: errorMessage },
			}));
			console.error("Failed to create MCP token:", error);
			throw error;
		}
	},

	updateMCPToken: async (id, name): Promise<void> => {
		const owner = generation;
		try {
			const result = await api.updateMCPToken(id, name);
			if (owner !== generation) return;
			if (!result.success) throw Error(result.error?.message ?? "Token update failed");

			set((state) => ({
				mcpTokens: state.mcpTokens.map((token) => (token.id === id ? { ...token, name } : token)),
				errors: { ...state.errors, tokens: null },
			}));
		} catch (error) {
			if (owner !== generation) return;
			const errorMessage = error instanceof Error ? error.message : "Failed to update MCP token";
			set((state) => ({
				errors: { ...state.errors, tokens: errorMessage },
			}));
			console.error("Failed to update MCP token:", error);
			throw error; // Re-throw for component error handling
		}
	},

	deleteMCPToken: async (id): Promise<void> => {
		const owner = generation;
		try {
			const result = await api.deleteMCPToken(id);
			if (owner !== generation) return;
			if (!result.success) throw Error(result.error?.message ?? "Token deletion failed");

			set((state) => ({
				mcpTokens: state.mcpTokens.filter((token) => token.id !== id),
				errors: { ...state.errors, tokens: null },
			}));
		} catch (error) {
			if (owner !== generation) return;
			const errorMessage = error instanceof Error ? error.message : "Failed to delete MCP token";
			set((state) => ({
				errors: { ...state.errors, tokens: errorMessage },
			}));
			console.error("Failed to delete MCP token:", error);
			throw error; // Re-throw for component error handling
		}
	},

	fetchCurrentUsage: async (): Promise<boolean> => {
		const owner = generation;
		set({
			isLoadingQuota: true,
			errors: { ...get().errors, quota: null },
		});

		try {
			const response = await api.getUserQuota();
			if (owner !== generation) return false;

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
			if (owner !== generation) return false;
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
		const owner = generation;
		set({
			isLoadingSubscription: true,
			errors: { ...get().errors, subscription: null },
		});

		try {
			const response = await api.getUserSubscription();
			if (owner !== generation) return false;
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
			if (owner !== generation) return false;
			const errorMessage = error instanceof Error ? error.message : "Failed to fetch subscription";
			console.error("Failed to fetch subscription:", error);
			set({
				isLoadingSubscription: false,
				errors: { ...get().errors, subscription: errorMessage },
			});
			return false;
		}
	},

	fetchUnreadReplies: async (): Promise<UnreadReplyItem[]> => {
		if (unreadInFlight) return unreadInFlight;
		const owner = generation;
		unreadInFlight = (async () => {
			try {
				const response = await api.getUnreadReplies();
				if (owner !== generation) return [];
				const messages =
					response.success && response.data
						? (response.data as { unreadMessages?: UnreadReplyItem[] }).unreadMessages || []
						: [];
				set({ unreadReplies: messages });
				return messages;
			} catch (error) {
				console.error("Failed to fetch unread replies:", error);
				return get().unreadReplies;
			} finally {
				unreadInFlight = null;
			}
		})();
		return unreadInFlight;
	},

	markReplyRead: async (id: string): Promise<boolean> => {
		const owner = generation;
		const response = await api.markMessageAsRead(id);
		if (owner !== generation) return false;
		if (response.success) {
			set((state) => ({
				unreadReplies: state.unreadReplies.filter((item) => item.id !== id),
			}));
			return true;
		}
		return false;
	},
}));
