import axios, { type AxiosError, type AxiosInstance, type AxiosResponse } from "axios";
import type { ApiResponse } from "@/types";
import { normalizeEmail } from "@/utils/email";
import { ADMIN_PASSWORD_HEADER, ADMIN_SESSION_KEY } from "./constants";

let isLoggingOut = false;

function extractErrorMessage(data: unknown): string | null {
	if (Array.isArray(data) && data.length > 0 && typeof data[0]?.message === "string") {
		return data[0].message;
	}
	if (typeof data === "object" && data !== null && "message" in data) {
		return String((data as Record<string, unknown>).message);
	}
	return null;
}

class ApiClient {
	private client: AxiosInstance;

	constructor(baseURL = "/api") {
		this.client = axios.create({
			baseURL,
			timeout: 30000,
			headers: { "Content-Type": "application/json" },
		});

		this.client.interceptors.request.use((config) => {
			try {
				const raw = localStorage.getItem("auth-storage");
				if (raw) {
					const token = JSON.parse(raw).state?.token;
					if (token) config.headers.Authorization = `Bearer ${token}`;
				}
			} catch {}

			if (config.url?.includes("/admin/")) {
				const pw = localStorage.getItem(ADMIN_SESSION_KEY);
				if (pw) config.headers[ADMIN_PASSWORD_HEADER] = pw;
			}

			return config;
		});

		this.client.interceptors.response.use(
			(r: AxiosResponse<ApiResponse>) => r,
			(error: AxiosError) => {
				const url = error.config?.url ?? "";
				const status = error.response?.status;
				const isAuthEndpoint = url.includes("/auth/login") || url.includes("/auth/register");

				if ((status === 401 || status === 403) && !isAuthEndpoint) {
					if (url.includes("/admin/")) {
						localStorage.removeItem(ADMIN_SESSION_KEY);
					} else if (!isLoggingOut) {
						isLoggingOut = true;
						import("@/stores/auth").then(({ useAuthStore }) => {
							useAuthStore.getState().logout();
							setTimeout(() => {
								isLoggingOut = false;
							}, 2000);
						});
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
		} catch (error: unknown) {
			const axiosError = error as AxiosError<ApiResponse>;
			const respData = axiosError.response?.data;

			if (respData) {
				if (respData.success === false && respData.error) {
					return respData;
				}

				// Normalize unexpected formats (e.g. raw Zod validation error arrays)
				const message = extractErrorMessage(respData);
				if (message) {
					return {
						success: false,
						error: { code: "VALIDATION_ERROR", message },
					} as ApiResponse<T>;
				}
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
		} catch (error: unknown) {
			const axiosError = error as AxiosError<ApiResponse>;
			// If we have a structured error response, return it
			if (axiosError.response?.data?.success === false) {
				return axiosError.response.data;
			}
			throw error;
		}
	}

	async delete<T>(url: string, config?: Record<string, unknown>): Promise<ApiResponse<T>> {
		try {
			const response = await this.client.delete(url, config);
			return response.data;
		} catch (error: unknown) {
			const axiosError = error as AxiosError<ApiResponse>;
			// If we have a structured error response, return it
			if (axiosError.response?.data?.success === false) {
				return axiosError.response.data;
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

	async getGoogleAuthUrl(state?: string) {
		return this.post("/oauth/google", { state });
	}

	async getGitHubAuthUrl(state?: string) {
		return this.post("/oauth/github", { state });
	}

	// MCP Tokens
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

	async createCheckoutSession(
		priceId: string,
		paymentMethod?: "card" | "alipay",
	): Promise<ApiResponse<{ url: string }>> {
		return this.post("/stripe/checkout", { priceId, cancelUrl: window.location.href, paymentMethod });
	}

	async createBillingPortalSession(): Promise<ApiResponse<{ url: string }>> {
		return this.post("/stripe/billing-portal");
	}

	// User profile
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
