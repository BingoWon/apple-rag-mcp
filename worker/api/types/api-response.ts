/**
 * 统一 API 响应格式系统
 * 优雅现代的响应格式，同时满足前端和 MCP 的需求
 */

// 基础成功响应
export interface ApiSuccessResponse<T = any> {
	success: true;
	data: T;
	meta?: {
		timestamp: string;
		request_id?: string;
		processing_time_ms?: number;
	};
}

// 基础错误响应
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

// 联合响应类型
export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

// 分页响应
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

// 用户认证响应
export interface AuthResponse {
	user: {
		id: string;
		email: string;
		name: string;
		email_verified: boolean;
		created_at: string;
	};
	token: string; // 简化的 token 字段，满足前端需求
	expires_at: string;
}

// MCP Token 响应 (simplified)
export interface MCPTokenResponse {
	id: string;
	name: string;
	token?: string; // 只在创建时返回
	last_used_at?: string;
	created_at: string;
}

// 配额信息响应
export interface QuotaResponse {
	current_usage: number;
	limit: number;
	remaining: number;
	reset_at: string;
	usage_percentage: number;
}

// 统一错误代码枚举 - 合并所有错误代码定义
export enum UnifiedErrorCode {
	// 认证错误
	UNAUTHORIZED = "UNAUTHORIZED",
	INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
	INVALID_TOKEN = "INVALID_TOKEN",
	TOKEN_EXPIRED = "TOKEN_EXPIRED",
	INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",
	USER_NOT_FOUND = "USER_NOT_FOUND",
	USER_DEACTIVATED = "USER_DEACTIVATED",
	EMAIL_ALREADY_EXISTS = "EMAIL_ALREADY_EXISTS",

	// MCP Token 错误
	MISSING_MCP_TOKEN = "MISSING_MCP_TOKEN",
	INVALID_MCP_TOKEN = "INVALID_MCP_TOKEN",
	INVALID_MCP_TOKEN_FORMAT = "INVALID_MCP_TOKEN_FORMAT",
	MCP_TOKEN_EXPIRED = "MCP_TOKEN_EXPIRED",
	MCP_TOKEN_NOT_FOUND = "MCP_TOKEN_NOT_FOUND",

	// 请求错误
	INVALID_REQUEST = "INVALID_REQUEST",
	MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD",
	INVALID_FIELD_VALUE = "INVALID_FIELD_VALUE",
	NOT_FOUND = "NOT_FOUND",

	// 资源错误
	RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
	RESOURCE_ALREADY_EXISTS = "RESOURCE_ALREADY_EXISTS",

	// 配额和限制错误
	QUOTA_EXCEEDED = "QUOTA_EXCEEDED",
	RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",

	// 订阅错误
	SUBSCRIPTION_NOT_FOUND = "SUBSCRIPTION_NOT_FOUND",
	SUBSCRIPTION_EXISTS = "SUBSCRIPTION_EXISTS",
	PLAN_NOT_FOUND = "PLAN_NOT_FOUND",

	// 服务错误
	INTERNAL_ERROR = "INTERNAL_ERROR",
	SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
	DATABASE_ERROR = "DATABASE_ERROR",
	MCP_SERVICE_ERROR = "MCP_SERVICE_ERROR",
	SSE_CONNECTION_ERROR = "SSE_CONNECTION_ERROR",
}

// 保持向后兼容的别名
export const ApiErrorCode = UnifiedErrorCode;
export const ErrorCode = UnifiedErrorCode;
export const MCPErrorCode = UnifiedErrorCode;

// 响应构建器工具类
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

// 权限映射工具
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
				// 如果是已经是后端格式的权限，直接添加
				backendPermissions.add(permission);
			}
		}

		return Array.from(backendPermissions);
	}

	static mapToFrontend(backendPermissions: string[]): string[] {
		// 简化映射：如果有 rag:query 权限，返回 read 和 write
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
