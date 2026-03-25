export interface ApiSuccessResponse<T = unknown> {
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
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface PaginatedData<T> {
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
