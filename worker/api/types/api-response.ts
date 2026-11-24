export interface ApiSuccessResponse<T = unknown> {
	success: true;
	data: T;
}

export interface ApiErrorResponse {
	success: false;
	error: {
		code: string;
		message: string;
		details?: unknown;
		suggestion?: string;
	};
	meta?: {
		timestamp: string;
	};
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

export function buildSuccess<T>(data: T): ApiSuccessResponse<T> {
	return {
		success: true as const,
		data,
	};
}

export function buildError(
	code: string,
	message: string,
	details?: unknown,
	suggestion?: string,
): ApiErrorResponse {
	return {
		success: false as const,
		error: { code, message, details, suggestion },
		meta: { timestamp: new Date().toISOString() },
	};
}

export const ResponseBuilder = {
	success: buildSuccess,
	error: buildError,
};
