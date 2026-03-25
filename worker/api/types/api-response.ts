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
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;
