export function buildSuccess<T>(data: T) {
	return {
		success: true as const,
		data,
	};
}

export function buildError(code: string, message: string, details?: unknown, suggestion?: string) {
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
