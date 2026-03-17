import axios, { type AxiosError, type AxiosInstance, type AxiosResponse } from "axios";
import type { ApiResponse } from "@/types";
import { normalizeEmail } from "@/utils/email";
import { ADMIN_PASSWORD_HEADER, ADMIN_SESSION_KEY } from "./constants";

interface ApiClientConfig {
	baseURL?: string;
	timeout?: number;
}

class ApiClient {
	private client: AxiosInstance;
	private baseURL: string;

	constructor(config: ApiClientConfig = {}) {
		this.baseURL = config.baseURL || "/api";

		this.client = axios.create({
			baseURL: this.baseURL,
			timeout: config.timeout || 30000,
			headers: {
				"Content-Type": "application/json",
			},
		});

		this.setupInterceptors();
	}

	private getTokenFromStorage(): string | null {
		if (typeof window === "undefined") return null;

		try {
			const authStorage = localStorage.getItem("auth-storage");
			if (authStorage) {
				const parsed = JSON.parse(authStorage);
				return parsed.state?.token || null;
			}
		} catch (error) {
			console.error("❌ [API CLIENT] Failed to get stored token:", error);
		}
		return null;
	}

	private clearAuthFromStorage(): void {
		if (typeof window === "undefined") return;

		console.log(
			"🚨 [API CLIENT] clearAuthFromStorage called - this should not happen during login!",
		);

		try {
			const authStorage = localStorage.getItem("auth-storage");
			if (authStorage) {
				const parsed = JSON.parse(authStorage);

				// Add safety check - don't clear if we just logged in recently or if user is authenticated
				const now = Date.now();
				const lastLogin = localStorage.getItem("last-login-time");

				// Check if we have a valid auth state
				const hasValidAuth = parsed.state?.isAuthenticated && parsed.state?.token;

				// Protect for 30 seconds after login, or if we have valid auth state
				if ((lastLogin && now - parseInt(lastLogin, 10) < 30000) || hasValidAuth) {
					console.log("🛡️ [API CLIENT] Preventing auth clear", {
						recentLogin: lastLogin && now - parseInt(lastLogin, 10) < 30000,
						hasValidAuth,
						timeSinceLogin: lastLogin ? now - parseInt(lastLogin, 10) : "N/A",
					});
					return;
				}

				parsed.state.token = null;
				parsed.state.isAuthenticated = false;
				parsed.state.user = null;
				localStorage.setItem("auth-storage", JSON.stringify(parsed));
			}
		} catch (error) {
			console.error("Failed to clear auth storage:", error);
		}
	}

	private setupInterceptors() {
		this.client.interceptors.request.use(
			(config) => {
				const token = this.getTokenFromStorage();
				if (token) {
					config.headers.Authorization = `Bearer ${token}`;
				}

				// Add admin password for admin endpoints
				if (config.url?.includes("/admin/")) {
					const adminPassword =
						typeof window !== "undefined" ? localStorage.getItem(ADMIN_SESSION_KEY) : null;
					if (adminPassword) {
						config.headers[ADMIN_PASSWORD_HEADER] = adminPassword;
					}
				}

				return config;
			},
			(error) => Promise.reject(error),
		);

		this.client.interceptors.response.use(
			(response: AxiosResponse<ApiResponse>) => {
				return response;
			},
			(error: AxiosError) => {
				const isAuthEndpoint =
					error.config?.url?.includes("/auth/login") ||
					error.config?.url?.includes("/auth/register");
				const isAdminEndpoint = error.config?.url?.includes("/admin/");

				if ((error.response?.status === 401 || error.response?.status === 403) && !isAuthEndpoint) {
					if (isAdminEndpoint) {
						// Admin authentication failed: clear admin session only
						if (typeof window !== "undefined") {
							localStorage.removeItem(ADMIN_SESSION_KEY);
						}
						// Don't redirect for admin errors, let the admin component handle it
					} else {
						// Main app authentication failed: clear auth and redirect
						this.clearAuthFromStorage();
						if (typeof window !== "undefined") {
							window.location.href = "/login";
						}
					}
				}
				return Promise.reject(error);
			},
		);
	}

	setAuthToken(token: string) {
		this.client.defaults.headers.common.Authorization = `Bearer ${token}`;
	}

	clearAuthToken() {
		delete this.client.defaults.headers.common.Authorization;
	}

	// HTTP methods
	async get<T>(url: string, config?: Record<string, unknown>): Promise<ApiResponse<T>> {
		const response = await this.client.get(url, config);
		return response.data;
	}

	async post<T>(
		url: string,
		data?: unknown,
		config?: Record<string, unknown>,
	): Promise<ApiResponse<T>> {
		try {
			const response = await this.client.post(url, data, config);
			return response.data;
		} catch (error: any) {
			// For auth endpoints, return the error response data instead of throwing
			if (error.response?.data && (url.includes("/auth/login") || url.includes("/auth/register"))) {
				return error.response.data;
			}

			// For other endpoints, if we have a structured error response, return it
			if (error.response?.data?.success === false) {
				return error.response.data;
			}

			throw error;
		}
	}

	async put<T>(
		url: string,
		data?: unknown,
		config?: Record<string, unknown>,
	): Promise<ApiResponse<T>> {
		try {
			const response = await this.client.put(url, data, config);
			return response.data;
		} catch (error: any) {
			// If we have a structured error response, return it
			if (error.response?.data?.success === false) {
				return error.response.data;
			}
			throw error;
		}
	}

	async delete<T>(url: string, config?: Record<string, unknown>): Promise<ApiResponse<T>> {
		try {
			const response = await this.client.delete(url, config);
			return response.data;
		} catch (error: any) {
			// If we have a structured error response, return it
			if (error.response?.data?.success === false) {
				return error.response.data;
			}
			throw error;
		}
	}

	async patch<T>(
		url: string,
		data?: unknown,
		config?: Record<string, unknown>,
	): Promise<ApiResponse<T>> {
		const response = await this.client.patch(url, data, config);
		return response.data;
	}

	// Auth endpoints with modern email normalization
	async login(credentials: { email: string; password: string; remember_me?: boolean }) {
		return this.post("/auth/login", {
			...credentials,
			email: normalizeEmail(credentials.email),
		});
	}

	async register(userData: {
		name: string;
		email: string;
		password: string;
		terms_accepted: boolean;
	}) {
		return this.post("/auth/register", {
			...userData,
			email: normalizeEmail(userData.email),
		});
	}

	async forgotPassword(email: string) {
		return this.post("/auth/forgot-password", {
			email: normalizeEmail(email),
		});
	}

	async resetPassword(token: string, password: string) {
		return this.post("/auth/reset-password", { token, password });
	}

	async changePassword(currentPassword: string, newPassword: string) {
		return this.post("/auth/change-password", { currentPassword, newPassword });
	}

	async getAuthStatus() {
		return this.get("/auth/auth-status");
	}

	async refreshToken() {
		return this.post("/auth/refresh");
	}

	// OAuth endpoints - 现代化实现
	async getGoogleAuthUrl(state?: string) {
		return this.post("/oauth/google", { state });
	}

	async getGitHubAuthUrl(state?: string) {
		return this.post("/oauth/github", { state });
	}

	// User endpoints (OAuth optimized - user info from JWT only)

	// MCP Token endpoints
	async getMCPTokens() {
		return this.get("/mcp-tokens");
	}

	async createMCPToken(data: { name: string; permissions?: string[] }) {
		return this.post("/mcp-tokens", data);
	}

	async updateMCPToken(id: string, name: string) {
		return this.put(`/mcp-tokens/${id}`, { name });
	}

	async deleteMCPToken(id: string) {
		return this.delete(`/mcp-tokens/${id}`);
	}

	async getMCPToken(id: string) {
		return this.get(`/mcp-tokens/${id}`);
	}

	async getUserQuota() {
		return this.get("/users/quota");
	}

	async getUserToolCallsStats(period: "24h" | "7d" | "30d" = "7d") {
		return this.get(`/users/usage/stats?period=${period}`);
	}

	async getUsageLogs(limit: number = 20, page: number = 1) {
		return this.get(`/usage-logs/history?limit=${limit}&page=${page}`);
	}

	// Filtered usage logs methods following consistent naming pattern
	async getUsageSearchLogs(limit: number = 20, page: number = 1) {
		return this.get(`/usage-logs/history?limit=${limit}&page=${page}&log_type=search`);
	}

	async getUsageFetchLogs(limit: number = 20, page: number = 1) {
		return this.get(`/usage-logs/history?limit=${limit}&page=${page}&log_type=fetch`);
	}

	// Admin API methods with pagination support
	async getAdminUsers(page: number = 1, limit: number = 50) {
		const offset = (page - 1) * limit;
		return this.get(`/admin/users?limit=${limit}&offset=${offset}`);
	}

	async getAdminMCPTokens(page: number = 1, limit: number = 50) {
		const offset = (page - 1) * limit;
		return this.get(`/admin/mcp-tokens?limit=${limit}&offset=${offset}`);
	}

	async getAdminSearchLogs(page: number = 1, limit: number = 50) {
		const offset = (page - 1) * limit;
		return this.get(`/admin/search-logs?limit=${limit}&offset=${offset}`);
	}

	async getAdminFetchLogs(page: number = 1, limit: number = 50) {
		const offset = (page - 1) * limit;
		return this.get(`/admin/fetch-logs?limit=${limit}&offset=${offset}`);
	}

	async getAdminUserSubscriptions(page: number = 1, limit: number = 50) {
		const offset = (page - 1) * limit;
		return this.get(`/admin/user-subscriptions?limit=${limit}&offset=${offset}`);
	}

	async getAdminContactMessages(page: number = 1, limit: number = 50) {
		const offset = (page - 1) * limit;
		return this.get(`/admin/contact-messages?limit=${limit}&offset=${offset}`);
	}

	async replyToContactMessage(id: string, data: { message: string; sendEmail: boolean }) {
		return this.post(`/admin/contact-messages/${id}/reply`, data);
	}

	async updateContactMessageStatus(id: string, data: { status: "pending" | "replied" | "closed" }) {
		return this.patch(`/admin/contact-messages/${id}/status`, data);
	}

	// User-facing contact message methods
	async getUnreadReplies() {
		return this.get("/contact-messages/my-replies");
	}

	async markMessageAsRead(id: string) {
		return this.post(`/contact-messages/${id}/read`, {});
	}

	async getMessageHistory(params?: {
		limit?: number;
		offset?: number;
		filter?: "all" | "unread" | "read";
		search?: string;
	}) {
		const queryParams = new URLSearchParams();
		if (params?.limit) queryParams.append("limit", params.limit.toString());
		if (params?.offset) queryParams.append("offset", params.offset.toString());
		if (params?.filter) queryParams.append("filter", params.filter);
		if (params?.search) queryParams.append("search", params.search);

		const query = queryParams.toString();
		return this.get(`/contact-messages/history${query ? `?${query}` : ""}`);
	}

	async getAdminAuthorizedIPs(page: number = 1, limit: number = 50) {
		const offset = (page - 1) * limit;
		return this.get(`/admin/authorized-ips?limit=${limit}&offset=${offset}`);
	}

	// Contact message submission
	async submitContactMessage(data: { email?: string; message: string; userId?: string }) {
		return this.post("/contact-messages", data);
	}

	async getUserSubscription() {
		return this.get("/stripe/subscription");
	}

	// User profile management (name only - email cannot be changed)
	async updateUserProfile(updates: { name?: string }) {
		return this.put("/users/profile", updates);
	}

	// Delete user account (hard delete)
	async deleteAccount() {
		return this.delete("/users/account");
	}

	// Authorized IPs management
	async getAuthorizedIPs() {
		return this.get("/authorized-ips");
	}

	async createAuthorizedIP(data: { ip_address: string; name: string }) {
		return this.post("/authorized-ips", data);
	}

	async updateAuthorizedIP(id: string, data: { name: string }) {
		return this.put(`/authorized-ips/${id}`, data);
	}

	async deleteAuthorizedIP(id: string) {
		return this.delete(`/authorized-ips/${id}`);
	}
}

export const api = new ApiClient();

// Export individual functions for convenience
export const forgotPassword = (email: string) => api.forgotPassword(email);
export const resetPassword = (token: string, password: string) =>
	api.resetPassword(token, password);
