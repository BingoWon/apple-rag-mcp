import axios, { type AxiosError, type AxiosInstance, type AxiosResponse } from "axios";
import type {
	AdminDashboardStats,
	AdminStatsQuery,
	ApiResponse,
	CorpusStats,
	CurrentUsage,
	User,
} from "@/types";
import type { AdminLogFilters, AdminLogKind, AdminLogsResponse } from "@/types/admin-logs";
import { normalizeEmail } from "@/utils/email";
import type {
	UpdatesDigestsResponse,
	UpdatesFeedResponse,
	UpdatesSummaryResponse,
} from "../../shared/doc-updates";
import type { ToolActivity, UsagePeriod } from "../../shared/tool-activity";
import { ADMIN_PASSWORD_HEADER, ADMIN_SESSION_KEY } from "./constants";
import { importWithRecovery, observeServerVersion } from "./deployment-recovery";

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
					if (token && !config.headers.Authorization && !config.url?.startsWith("/oauth/"))
						config.headers.Authorization = `Bearer ${token}`;
				}
			} catch {}

			if (config.url?.includes("/admin")) {
				const pw = localStorage.getItem(ADMIN_SESSION_KEY);
				if (pw) config.headers[ADMIN_PASSWORD_HEADER] = pw;
			}

			return config;
		});

		this.client.interceptors.response.use(
			(r: AxiosResponse<ApiResponse>) => {
				observeServerVersion(r.headers?.["x-app-version"]);
				return r;
			},
			(error: AxiosError<ApiResponse>) => {
				observeServerVersion(error.response?.headers?.["x-app-version"]);
				const url = error.config?.url ?? "";
				const status = error.response?.status;
				const isAuthEndpoint = url.includes("/auth/login") || url.includes("/auth/register");

				if ((status === 401 || status === 403) && !isAuthEndpoint) {
					if (url.includes("/admin")) {
						localStorage.removeItem(ADMIN_SESSION_KEY);
						if (typeof window !== "undefined") {
							window.dispatchEvent(new CustomEvent("admin-auth-expired"));
						}
					} else if (status === 401 && error.config?.headers.Authorization) {
						const rejected = error.config.headers.Authorization;
						void importWithRecovery(() => import("@/stores/auth")).then(({ useAuthStore }) => {
							const state = useAuthStore.getState();
							if (rejected === "Bearer " + state.token) state.clearSession();
						});
					}
				}
				const backendMessage =
					error.response?.data?.error?.message || extractErrorMessage(error.response?.data);
				if (backendMessage) {
					error.message = backendMessage;
				}
				return Promise.reject(error);
			},
		);
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
					return respData as ApiResponse<T>;
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
				return axiosError.response.data as ApiResponse<T>;
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
				return axiosError.response.data as ApiResponse<T>;
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
		return this.post<{ token: string }>("/auth/login", {
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
		return this.post<{ token: string }>("/auth/register", {
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

	async getGoogleAuthUrl() {
		return this.post("/oauth/google", {});
	}

	async getGitHubAuthUrl() {
		return this.post("/oauth/github", {});
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

	async getUserQuota(signal?: AbortSignal) {
		return this.get<CurrentUsage>("/users/quota", { signal });
	}

	async getUserToolCallsStats(period: UsagePeriod, signal?: AbortSignal) {
		return this.get<ToolActivity>("/users/usage/stats", { params: { period }, signal });
	}

	async getCorpusStats(signal?: AbortSignal) {
		return this.get<CorpusStats>("/stats/corpus", { signal });
	}

	async getUpdatesSummary(signal?: AbortSignal) {
		return this.get<UpdatesSummaryResponse>("/updates/summary", { signal });
	}

	async getUpdatesFeed(
		params: {
			framework?: string;
			kind?: string;
			significance?: string;
			days?: number;
			q?: string;
			limit?: number;
			offset?: number;
		},
		signal?: AbortSignal,
	) {
		return this.get<UpdatesFeedResponse>("/updates/feed", { params, signal });
	}

	async getUpdatesDigests(period: "daily" | "weekly", limit = 14, signal?: AbortSignal) {
		return this.get<UpdatesDigestsResponse>("/updates/digests", {
			params: { period, limit },
			signal,
		});
	}

	async getUsageLogs(
		limit = 20,
		page = 1,
		kind: "all" | "search" | "fetch" | "browse" = "all",
		from?: string,
		to?: string,
		status?: "all" | "success" | "error",
		search?: string,
	) {
		return this.get("/usage-logs/history", {
			params: {
				limit,
				page,
				log_type: kind,
				from,
				to,
				status: status && status !== "all" ? status : undefined,
				search: search?.trim() || undefined,
			},
		});
	}

	// Admin API methods with pagination support
	async verifyAdminSession() {
		return this.get("/admin");
	}

	async getAdminStats(query: AdminStatsQuery, signal?: AbortSignal) {
		return this.get<AdminDashboardStats>("/admin/stats", { params: query, signal });
	}

	async getAdminUsers(page: number = 1, limit: number = 50, signal?: AbortSignal) {
		const offset = (page - 1) * limit;
		return this.get(`/admin/users?limit=${limit}&offset=${offset}`, { signal });
	}

	async getAdminMCPTokens(page: number = 1, limit: number = 50, signal?: AbortSignal) {
		const offset = (page - 1) * limit;
		return this.get(`/admin/mcp-tokens?limit=${limit}&offset=${offset}`, { signal });
	}

	async getAdminLogs(
		kind: AdminLogKind,
		page: number,
		limit: number,
		filters: AdminLogFilters,
		signal: AbortSignal,
	) {
		return this.get<AdminLogsResponse>(`/admin/${kind}-logs`, {
			params: { ...filters, limit, offset: (page - 1) * limit },
			signal,
		});
	}

	async getAdminUserSubscriptions(page: number = 1, limit: number = 50, signal?: AbortSignal) {
		const offset = (page - 1) * limit;
		return this.get(`/admin/user-subscriptions?limit=${limit}&offset=${offset}`, { signal });
	}

	async getAdminContactMessages(page: number = 1, limit: number = 50, signal?: AbortSignal) {
		const offset = (page - 1) * limit;
		return this.get(`/admin/contact-messages?limit=${limit}&offset=${offset}`, { signal });
	}

	async replyToContactMessage(id: string, data: { message: string; sendEmail: boolean }) {
		return this.post(`/admin/contact-messages/${id}/reply`, data);
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

	async getAdminAuthorizedIPs(page: number = 1, limit: number = 50, signal?: AbortSignal) {
		const offset = (page - 1) * limit;
		return this.get(`/admin/authorized-ips?limit=${limit}&offset=${offset}`, { signal });
	}

	// Contact message submission
	async submitContactMessage(data: { email?: string; message: string }) {
		return this.post("/contact-messages", data);
	}

	async getUserSubscription() {
		return this.get("/stripe/subscription");
	}

	async createCheckoutSession(
		priceId: string,
		paymentMethod?: "card" | "alipay",
	): Promise<ApiResponse<{ url: string }>> {
		return this.post("/stripe/checkout", {
			priceId,
			cancelUrl: window.location.href,
			paymentMethod,
		});
	}

	async createBillingPortalSession(): Promise<ApiResponse<{ url: string }>> {
		return this.post("/stripe/billing-portal");
	}

	// User profile
	async updateUserProfile(updates: { name?: string }): Promise<ApiResponse<User>> {
		return this.put<User>("/users/profile", updates);
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

export const resetPassword = (token: string, password: string) =>
	api.resetPassword(token, password);
