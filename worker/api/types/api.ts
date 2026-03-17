/**
 * API request and response types
 */

// API响应类型已迁移到 api-response.ts
// 导入统一的响应类型
import type { ApiResponse } from "./api-response";

export type { ApiResponse };

// Authentication requests
export interface RegisterRequest {
	email: string;
	password: string;
	name?: string;
	terms_accepted: boolean;
}

export interface LoginRequest {
	email: string;
	password: string;
}

// 错误代码已迁移到 api-response.ts 中的 UnifiedErrorCode
// 导入统一的错误代码
import { UnifiedErrorCode as ErrorCode } from "./api-response";

export { ErrorCode };
