/**
 * Modern Unified Response Type System
 * Provides type-safe, consistent API responses for all endpoints
 */

import { z } from "zod";

// Base response schemas
export const BaseSuccessResponseSchema = z.object({
	success: z.literal(true),
});

export const BaseErrorResponseSchema = z.object({
	success: z.literal(false),
	error: z.object({
		code: z.string(),
		message: z.string(),
		details: z.unknown().optional(),
		suggestion: z.string().optional(),
	}),
	meta: z
		.object({
			timestamp: z.string(),
			request_id: z.string().optional(),
			processing_time_ms: z.number().optional(),
		})
		.optional(),
});

// Generic success response with data
export const createSuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
	BaseSuccessResponseSchema.extend({
		data: dataSchema,
	});

// Standard error responses for different status codes
export const ErrorResponseSchemas = {
	400: BaseErrorResponseSchema,
	401: BaseErrorResponseSchema,
	403: BaseErrorResponseSchema,
	404: BaseErrorResponseSchema,
	409: BaseErrorResponseSchema,
	422: BaseErrorResponseSchema,
	429: BaseErrorResponseSchema,
	500: BaseErrorResponseSchema,
} as const;

// Response type helpers
export type SuccessResponse<T> = {
	success: true;
	data: T;
};

export type ErrorResponse = {
	success: false;
	error: {
		code: string;
		message: string;
		details?: unknown;
		suggestion?: string;
	};
	meta?: {
		timestamp: string;
		request_id?: string;
		processing_time_ms?: number;
	};
};

// Modern OpenAPI response definitions helper
export const createOpenAPIResponses = <T extends z.ZodTypeAny>(
	successSchema: T,
	successStatusCode: number = 200,
	additionalErrors: (keyof typeof ErrorResponseSchemas)[] = [],
) => {
	const baseErrors: (keyof typeof ErrorResponseSchemas)[] = [401, 500];
	const allErrors = [...new Set([...baseErrors, ...additionalErrors])];

	const responses: Record<string, unknown> = {
		[successStatusCode]: {
			description: "Success",
			content: {
				"application/json": {
					schema: createSuccessResponseSchema(successSchema),
				},
			},
		},
	};

	for (const statusCode of allErrors) {
		responses[statusCode] = {
			description: getErrorDescription(statusCode),
			content: {
				"application/json": {
					schema: ErrorResponseSchemas[statusCode],
				},
			},
		};
	}

	return responses;
};

// Error description helper
function getErrorDescription(statusCode: keyof typeof ErrorResponseSchemas): string {
	const descriptions = {
		400: "Bad Request",
		401: "Unauthorized",
		403: "Forbidden",
		404: "Not Found",
		409: "Conflict",
		422: "Unprocessable Entity",
		429: "Too Many Requests",
		500: "Internal Server Error",
	};
	return descriptions[statusCode];
}

// Pagination response type
export type PaginatedResponse<T> = {
	items: T[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		total_pages: number;
		has_next: boolean;
		has_prev: boolean;
	};
};

// Response builder helpers
export function buildSuccess<T>(data: T, _statusCode: 200 | 201 = 200) {
	return {
		success: true as const,
		data,
	};
}

export function buildError(
	code: string,
	message: string,
	_statusCode: keyof typeof ErrorResponseSchemas = 500,
	details?: unknown,
	suggestion?: string,
) {
	return {
		success: false as const,
		error: {
			code,
			message,
			details,
			suggestion,
		},
		meta: {
			timestamp: new Date().toISOString(),
		},
	};
}

export function buildPaginated<T>(items: T[], page: number, limit: number, total: number) {
	return {
		success: true as const,
		data: {
			items,
			pagination: {
				page,
				limit,
				total,
				total_pages: Math.ceil(total / limit),
				has_next: page * limit < total,
				has_prev: page > 1,
			},
		},
	};
}

export const ResponseBuilder = {
	success: buildSuccess,
	error: buildError,
	paginated: buildPaginated,
};
