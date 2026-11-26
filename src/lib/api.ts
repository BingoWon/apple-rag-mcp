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
import { getSignupSource } from "./attribution";
import { ADMIN_PASSWORD_HEADER, ADMIN_SESSION_KEY } from "./constants";
import { importWithRecovery, observeServerVersion } from "./deployment-recovery";

const REQUEST_TIMEOUT_MS = 30_000;

type QueryParams = Record<string, string | number | boolean | undefined | null>;

interface RequestConfig {
	params?: QueryParams;
	headers?: Record<string, string>;
	signal?: AbortSignal;
}

export class ApiError extends Error {
	status: number;
	data?: unknown;

	constructor(message: string, status: number, data?: unknown) {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.data = data;
	}
}

function extractErrorMessage(data: unknown): string | null {
	if (Array.isArray(data) && data.length > 0 && typeof data[0]?.message === "string") {
		return data[0].message;
	}
	if (typeof data === "object" && data !== null && "message" in data) {
		return String((data as Record<string, unknown>).message);
	}
	return null;
}

function buildUrl(baseURL: string, path: string, params?: QueryParams): string {
	const base = `${baseURL}${path}`;
	if (!params) return base;
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== null) {
			search.append(key, String(value));
		}
	}
	const qs = search.toString();
	if (!qs) return base;
	return `${base}${base.includes("?") ? "&" : "?"}${qs}`;
}

function createTimedSignal(signal?: AbortSignal): { signal: AbortSignal; cleanup: () => void } {
	const controller = new AbortController();
	const timer = setTimeout(() => {
		controller.abort(new DOMException("Request timed out", "TimeoutError"));
	}, REQUEST_TIMEOUT_MS);

	const onAbort = () => controller.abort(signal?.reason);
	if (signal) {
		if (signal.aborted) {
			controller.abort(signal.reason);
		} else {
			signal.addEventListener("abort", onAbort, { once: true });
		}
	}

	return {
		signal: controller.signal,
		cleanup: () => {
			clearTimeout(timer);
			signal?.removeEventListener("abort", onAbort);
		},
	};
}

class ApiClient {
	private baseURL: string;

	constructor(baseURL = "/api") {
		this.baseURL = baseURL;
	}

	private async request<T>(
		method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
		path: string,
		data?: unknown,
		config?: RequestConfig,
	): Promise<{ ok: boolean; status: number; body: unknown; data: ApiResponse<T> | null }> {
		const headers = new Headers({ "Content-Type": "application/json" });
		if (config?.headers) {
			for (const [key, value] of Object.entries(config.headers)) {
				headers.set(key, value);
			}
		}

		try {
			const raw = localStorage.getItem("auth-storage");
			if (raw) {
				const token = JSON.parse(raw).state?.token;
				if (token && !headers.has("Authorization") && !path.startsWith("/oauth/")) {
					headers.set("Authorization", `Bearer ${token}`);
				}
			}
		} catch {}

		if (path.includes("/admin")) {
			const pw = localStorage.getItem(ADMIN_SESSION_KEY);
			if (pw) headers.set(ADMIN_PASSWORD_HEADER, pw);
		}

		const { signal, cleanup } = createTimedSignal(config?.signal);
		let response: Response;
		try {
			response = await fetch(buildUrl(this.baseURL, path, config?.params), {
				method,
				headers,
				body: data !== undefined ? JSON.stringify(data) : undefined,
				signal,
			});
		} finally {
			cleanup();
		}

		observeServerVersion(response.headers.get("x-app-version"));
		const body = await response.json().catch(() => null);
		const parsed =
			body && typeof body === "object" && !Array.isArray(body) ? (body as ApiResponse<T>) : null;

		if (!response.ok) {
			const isAuthEndpoint = path.includes("/auth/login") || path.includes("/auth/register");
			if ((response.status === 401 || response.status === 403) && !isAuthEndpoint) {
				if (path.includes("/admin")) {
					localStorage.removeItem(ADMIN_SESSION_KEY);
					if (typeof window !== "undefined") {
						window.dispatchEvent(new CustomEvent("admin-auth-expired"));
					}
				} else if (response.status === 401 && headers.has("Authorization")) {
					const rejected = headers.get("Authorization");
					void importWithRecovery(() => import("@/stores/auth")).then(({ useAuthStore }) => {
						const state = useAuthStore.getState();
						if (rejected === `Bearer ${state.token}`) state.clearSession();
					});
				}
			}
		}

		return { ok: response.ok, status: response.status, body, data: parsed };
	}

	private toError(status: number, body: unknown, parsed: ApiResponse<unknown> | null): ApiError {
		const message =
			parsed?.error?.message || extractErrorMessage(body) || `Request failed with status ${status}`;
		return new ApiError(message, status, body);
	}

	async get<T>(url: string, config?: RequestConfig): Promise<ApiResponse<T>> {
		const res = await this.request<T>("GET", url, undefined, config);
		if (!res.ok) throw this.toError(res.status, res.body, res.data);
		return res.data as ApiResponse<T>;
	}

	async post<T>(url: string, data?: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
		const res = await this.request<T>("POST", url, data, config);
		if (res.ok) return res.data as ApiResponse<T>;
		if (res.data?.success === false && res.data.error) {
			return res.data;
		}
		const message = extractErrorMessage(res.body);
		if (message) {
			return {
				success: false,
				error: { code: "VALIDATION_ERROR", message },
			} as ApiResponse<T>;
		}
		throw this.toError(res.status, res.body, res.data);
	}

	async put<T>(url: string, data?: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
		const res = await this.request<T>("PUT", url, data, config);
		if (res.ok) return res.data as ApiResponse<T>;
		if (res.data?.success === false) return res.data;
		throw this.toError(res.status, res.body, res.data);
	}

	async delete<T>(url: string, config?: RequestConfig): Promise<ApiResponse<T>> {
		const res = await this.request<T>("DELETE", url, undefined, config);
		if (res.ok) return res.data as ApiResponse<T>;
		if (res.data?.success === false) return res.data;
		throw this.toError(res.status, res.body, res.data);
	}

	async patch<T>(url: string, data?: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
		const res = await this.request<T>("PATCH", url, data, config);
		if (!res.ok) throw this.toError(res.status, res.body, res.data);
		return res.data as ApiResponse<T>;
	}

	// Auth endpoints
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
		signup_source?: string;
	}) {
		return this.post<{ token: string }>("/auth/register", {
			...userData,
			email: normalizeEmail(userData.email),
			signup_source: userData.signup_source ?? getSignupSource(),
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
		const signup_source = getSignupSource();
		return this.post("/oauth/google", signup_source ? { signup_source } : {});
	}

	async getGitHubAuthUrl() {
		const signup_source = getSignupSource();
		return this.post("/oauth/github", signup_source ? { signup_source } : {});
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

	// Admin endpoints
	async verifyAdminSession() {
		return this.get("/admin");
	}

	async getAdminStats(query: AdminStatsQuery, signal?: AbortSignal) {
		return this.get<AdminDashboardStats>("/admin/stats", {
			params: { ...query },
			signal,
		});
	}

	async getAdminUsers(page = 1, limit = 50, signal?: AbortSignal) {
		return this.get("/admin/users", { params: { limit, offset: (page - 1) * limit }, signal });
	}

	async getAdminMCPTokens(page = 1, limit = 50, signal?: AbortSignal) {
		return this.get("/admin/mcp-tokens", { params: { limit, offset: (page - 1) * limit }, signal });
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

	async getAdminUserSubscriptions(page = 1, limit = 50, signal?: AbortSignal) {
		return this.get("/admin/user-subscriptions", {
			params: { limit, offset: (page - 1) * limit },
			signal,
		});
	}

	async getAdminContactMessages(page = 1, limit = 50, signal?: AbortSignal) {
		return this.get("/admin/contact-messages", {
			params: { limit, offset: (page - 1) * limit },
			signal,
		});
	}

	async replyToContactMessage(id: string, data: { message: string; sendEmail: boolean }) {
		return this.post(`/admin/contact-messages/${id}/reply`, data);
	}

	// Contact messages
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
		return this.get("/contact-messages/history", { params });
	}

	async getAdminAuthorizedIPs(page = 1, limit = 50, signal?: AbortSignal) {
		return this.get("/admin/authorized-ips", {
			params: { limit, offset: (page - 1) * limit },
			signal,
		});
	}

	async submitContactMessage(data: { email?: string; message: string }) {
		return this.post("/contact-messages", data);
	}

	// Billing
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

	// Profile & account
	async updateUserProfile(updates: { name?: string }): Promise<ApiResponse<User>> {
		return this.put<User>("/users/profile", updates);
	}

	async deleteAccount() {
		return this.delete("/users/account");
	}

	// Authorized IPs
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
