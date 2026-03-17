/**
 * Unified API response format for frontend and MCP
 */

export interface ApiSuccessResponse<T = any> {
	success: true;
	data: T;
	meta?: {
		timestamp: string;
		request_id?: string;
		processing_time_ms?: number;
	};
}

export interface ApiErrorResponse {
	success: false;
	error: {
		code: UnifiedErrorCode | string;
		message: string;
		details?: any;
		suggestion?: string;
	};
	meta?: {
		timestamp: string;
		request_id?: string;
		processing_time_ms?: number;
	};
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface PaginatedResponse<T> {
	items: T[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		total_pages: number;
		has_next: boolean;
		has_prev: boolean;
	};
}

export interface AuthResponse {
	user: {
		id: string;
		email: string;
		name: string;
		email_verified: boolean;
		created_at: string;
	};
	token: string;
	expires_at: string;
}

export interface MCPTokenResponse {
	id: string;
	name: string;
	token?: string;
	last_used_at?: string;
	created_at: string;
}

export interface QuotaResponse {
	current_usage: number;
	limit: number;
	remaining: number;
	reset_at: string;
	usage_percentage: number;
}

export enum UnifiedErrorCode {
	UNAUTHORIZED = "UNAUTHORIZED",
	INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
	INVALID_TOKEN = "INVALID_TOKEN",
	TOKEN_EXPIRED = "TOKEN_EXPIRED",
	INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",
	USER_NOT_FOUND = "USER_NOT_FOUND",
	USER_DEACTIVATED = "USER_DEACTIVATED",
	EMAIL_ALREADY_EXISTS = "EMAIL_ALREADY_EXISTS",

	MISSING_MCP_TOKEN = "MISSING_MCP_TOKEN",
	INVALID_MCP_TOKEN = "INVALID_MCP_TOKEN",
	INVALID_MCP_TOKEN_FORMAT = "INVALID_MCP_TOKEN_FORMAT",
	MCP_TOKEN_EXPIRED = "MCP_TOKEN_EXPIRED",
	MCP_TOKEN_NOT_FOUND = "MCP_TOKEN_NOT_FOUND",

	INVALID_REQUEST = "INVALID_REQUEST",
	MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD",
	INVALID_FIELD_VALUE = "INVALID_FIELD_VALUE",
	NOT_FOUND = "NOT_FOUND",

	RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
	RESOURCE_ALREADY_EXISTS = "RESOURCE_ALREADY_EXISTS",

	QUOTA_EXCEEDED = "QUOTA_EXCEEDED",
	RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",

	SUBSCRIPTION_NOT_FOUND = "SUBSCRIPTION_NOT_FOUND",
	SUBSCRIPTION_EXISTS = "SUBSCRIPTION_EXISTS",
	PLAN_NOT_FOUND = "PLAN_NOT_FOUND",

	INTERNAL_ERROR = "INTERNAL_ERROR",
	SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
	DATABASE_ERROR = "DATABASE_ERROR",
	MCP_SERVICE_ERROR = "MCP_SERVICE_ERROR",
	SSE_CONNECTION_ERROR = "SSE_CONNECTION_ERROR",
}

// Backward compatibility aliases
export const ApiErrorCode = UnifiedErrorCode;
export const ErrorCode = UnifiedErrorCode;
export const MCPErrorCode = UnifiedErrorCode;

export class ResponseBuilder {
	static success<T>(data: T, meta?: any): ApiSuccessResponse<T> {
		return {
			success: true,
			data,
			meta: {
				timestamp: new Date().toISOString(),
				...meta,
			},
		};
	}

	static error(
		code: UnifiedErrorCode | string,
		message: string,
		details?: any,
		suggestion?: string,
		meta?: any,
	): ApiErrorResponse {
		return {
			success: false,
			error: {
				code,
				message,
				details,
				suggestion,
			},
			meta: {
				timestamp: new Date().toISOString(),
				...meta,
			},
		};
	}

	static paginated<T>(
		items: T[],
		page: number,
		limit: number,
		total: number,
		meta?: any,
	): ApiSuccessResponse<PaginatedResponse<T>> {
		const totalPages = Math.ceil(total / limit);

		return ResponseBuilder.success(
			{
				items,
				pagination: {
					page,
					limit,
					total,
					total_pages: totalPages,
					has_next: page < totalPages,
					has_prev: page > 1,
				},
			},
			meta,
		);
	}
}

export class PermissionMapper {
	private static readonly PERMISSION_MAP: Record<string, string[]> = {
		read: ["rag:query"],
		write: ["rag:query"],
		admin: ["rag:query", "admin:manage"],
		full: ["rag:query", "admin:manage", "stats:read"],
	};

	static mapToBackend(frontendPermissions: string[]): string[] {
		const backendPermissions = new Set<string>();

		for (const permission of frontendPermissions) {
			const mapped = PermissionMapper.PERMISSION_MAP[permission];
			if (mapped) {
				mapped.forEach((p) => backendPermissions.add(p));
			} else {
				backendPermissions.add(permission);
			}
		}

		return Array.from(backendPermissions);
	}

	static mapToFrontend(backendPermissions: string[]): string[] {
		if (backendPermissions.includes("rag:query")) {
			const permissions = ["read", "write"];
			if (backendPermissions.includes("admin:manage")) {
				permissions.push("admin");
			}
			return permissions;
		}

		return backendPermissions;
	}
}
