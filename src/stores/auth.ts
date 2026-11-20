import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/lib/api";
import type { ApiResponse, LoginCredentials, RegisterData, User } from "@/types";
import { getFriendlyErrorMessage } from "@/utils/errorMessages";
import { extractUserFromJWTToken, isJWTTokenExpired } from "@/utils/mcpTokenUtils";
import { resetDashboard } from "./dashboard";

interface AuthState {
	user: User | null;
	token: string | null;
	isAuthenticated: boolean;
	isLoading: boolean;
	isHydrated: boolean;
	login: (credentials: LoginCredentials) => Promise<void>;
	register: (data: RegisterData) => Promise<void>;
	loginWithToken: (token: string) => void;
	logout: () => Promise<void>;
	clearSession: () => void;
	updateUser: (updates: Partial<User>) => void;
	setHydrated: (value: boolean) => void;
}
export const useAuthStore = create<AuthState>()(
	persist(
		(set, get) => {
			async function authenticate(request: Promise<ApiResponse<{ token: string }>>) {
				set({ isLoading: true });
				try {
					const result = await request;
					if (!result.success || !result.data)
						throw Error(
							getFriendlyErrorMessage(result.error?.code, result.error?.message ?? "Login failed"),
						);
					get().loginWithToken(result.data.token);
				} finally {
					set({ isLoading: false });
				}
			}
			return {
				user: null,
				token: null,
				isAuthenticated: false,
				isLoading: false,
				isHydrated: false,
				login: (input) => authenticate(api.login(input)),
				register: (input) => authenticate(api.register(input)),
				loginWithToken: (token) => {
					if (isJWTTokenExpired(token)) throw Error("Login expired");
					set({ user: extractUserFromJWTToken(token), token, isAuthenticated: true });
				},
				clearSession: () =>
					set({ user: null, token: null, isAuthenticated: false, isLoading: false }),
				logout: async () => {
					const token = get().token;
					if (token) {
						const r = await api.post("/auth/logout", undefined, {
							headers: { Authorization: "Bearer " + token },
						});
						if (!r.success && r.error?.code !== "INVALID_TOKEN")
							throw Error(r.error?.message ?? "Logout failed");
					}
					if (get().token === token) get().clearSession();
				},
				updateUser: (updates) => {
					const user = get().user;
					if (user) set({ user: { ...user, ...updates } });
				},
				setHydrated: (isHydrated) => set({ isHydrated }),
			};
		},
		{
			name: "auth-storage",
			version: 1,
			migrate: () => ({ user: null, token: null, isAuthenticated: false }),
			partialize: ({ user, token, isAuthenticated }) => ({ user, token, isAuthenticated }),
			onRehydrateStorage: () => (state) => {
				if (!state) {
					queueMicrotask(() => {
						const auth = useAuthStore.getState();
						auth.clearSession();
						auth.setHydrated(true);
					});
					return;
				}
				if (state.token && isJWTTokenExpired(state.token)) state.clearSession();
				if (!state.isHydrated) state.setHydrated(true);
			},
		},
	),
);
useAuthStore.subscribe((state, previous) => {
	if (state.token !== previous.token) resetDashboard();
});
if (typeof window !== "undefined")
	window.addEventListener?.("storage", (event) => {
		if (event.key === null) {
			useAuthStore.getState().clearSession();
			return;
		}
		if (event.key === "auth-storage") {
			if (event.newValue === null) useAuthStore.getState().clearSession();
			else void useAuthStore.persist.rehydrate();
		}
	});
