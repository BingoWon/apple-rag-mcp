import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/lib/api";
import type {
	AuthResponseData,
	AuthTokens,
	ExtractedAuthData,
	LoginCredentials,
	RegisterData,
	User,
} from "@/types";
import { getFriendlyErrorMessage } from "@/utils/errorMessages";

function isTokenExpired(token: string): boolean {
	try {
		const payload = JSON.parse(atob(token.split(".")[1]));
		return payload.exp ? payload.exp * 1000 < Date.now() : false;
	} catch {
		return true;
	}
}

interface AuthState {
	user: User | null;
	token: string | null;
	isAuthenticated: boolean;
	isLoading: boolean;
	isHydrated: boolean;

	login: (credentials: LoginCredentials) => Promise<void>;
	loginWithToken: (token: string) => Promise<void>;
	register: (userData: RegisterData) => Promise<void>;
	logout: () => void;
	refreshUser: () => Promise<void>;
	updateUser: (updates: Partial<User>) => void;
	setHydrated: (hydrated: boolean) => void;
}

const extractTokenFromTokens = (tokens: AuthTokens | string): string | null => {
	if (typeof tokens === "string") return tokens;
	return tokens.access_token || tokens.token || null;
};

const extractAuthData = (responseData: AuthResponseData): ExtractedAuthData | null => {
	// Direct token structure
	if (responseData.data?.user && responseData.data?.token) {
		return { user: responseData.data.user, token: responseData.data.token };
	}
	if (responseData.user && responseData.token) {
		return { user: responseData.user, token: responseData.token };
	}

	// Tokens object structure
	if (responseData.user && responseData.tokens) {
		const token = extractTokenFromTokens(responseData.tokens);
		return token ? { user: responseData.user, token } : null;
	}
	if (responseData.data?.user && responseData.data?.tokens) {
		const token = extractTokenFromTokens(responseData.data.tokens);
		return token ? { user: responseData.data.user, token } : null;
	}

	return null;
};

export const useAuthStore = create<AuthState>()(
	persist(
		(set, get) => ({
			user: null,
			token: null,
			isAuthenticated: false,
			isLoading: false,
			isHydrated: false,

			login: async (credentials) => {
				set({ isLoading: true });

				try {
					const response = await api.login(credentials);

					if (response.success && response.data) {
						const authData = extractAuthData(response.data);

						if (!authData?.token || !authData?.user) {
							throw new Error("Invalid authentication response");
						}

						api.setAuthToken(authData.token);

						set({
							user: authData.user,
							token: authData.token,
							isAuthenticated: true,
							isLoading: false,
						});
					} else {
						// 使用友好的错误信息
						const errorCode = response.error?.code;
						const errorMessage = response.error?.message ?? "Login failed";
						const friendlyMessage = getFriendlyErrorMessage(errorCode, errorMessage);
						throw new Error(friendlyMessage);
					}
				} catch (error) {
					set({ isLoading: false });
					throw error;
				}
			},

			register: async (userData) => {
				set({ isLoading: true });

				try {
					const response = await api.register(userData);

					if (response.success && response.data) {
						const authData = extractAuthData(response.data);

						if (!authData?.token || !authData?.user) {
							throw new Error("Invalid registration response");
						}

						api.setAuthToken(authData.token);

						set({
							user: authData.user,
							token: authData.token,
							isAuthenticated: true,
							isLoading: false,
						});
					} else {
						// 使用友好的错误信息
						const errorCode = response.error?.code;
						const errorMessage = response.error?.message ?? "Registration failed";
						const friendlyMessage = getFriendlyErrorMessage(errorCode, errorMessage);
						throw new Error(friendlyMessage);
					}
				} catch (error) {
					set({ isLoading: false });
					throw error;
				}
			},

			loginWithToken: async (token: string) => {
				set({ token, isLoading: true });
				api.setAuthToken(token);

				try {
					const { extractUserFromJWTToken, isJWTTokenExpired } = await import(
						"@/utils/mcpTokenUtils"
					);

					if (isJWTTokenExpired(token)) {
						throw new Error("JWT Token has expired");
					}

					const user = extractUserFromJWTToken(token);

					set({
						user,
						isAuthenticated: true,
						isLoading: false,
					});
				} catch (error) {
					set({ token: null, isAuthenticated: false, isLoading: false });
					api.clearAuthToken();
					throw error;
				}
			},

			logout: () => {
				api.clearAuthToken();
				set({
					user: null,
					token: null,
					isAuthenticated: false,
					isLoading: false,
				});
			},

			refreshUser: async () => {
				const { token } = get();
				if (!token) return;

				try {
					const { extractUserFromJWTToken, isJWTTokenExpired } = await import(
						"@/utils/mcpTokenUtils"
					);

					if (isJWTTokenExpired(token)) {
						get().logout();
						return;
					}

					const user = extractUserFromJWTToken(token);

					set({ user });
				} catch (_error) {
					get().logout();
				}
			},

			updateUser: (updates: Partial<User>) => {
				const { user } = get();
				if (user) {
					set({ user: { ...user, ...updates } });
				}
			},

			setHydrated: (hydrated: boolean) => set({ isHydrated: hydrated }),
		}),
		{
			name: "auth-storage",
			partialize: (state) => ({
				user: state.user,
				token: state.token,
				isAuthenticated: state.isAuthenticated,
			}),
			onRehydrateStorage: () => (state) => {
				if (!state) return;
				if (state.token && isTokenExpired(state.token)) {
					state.logout();
				}
				state.setHydrated(true);
			},
		},
	),
);
