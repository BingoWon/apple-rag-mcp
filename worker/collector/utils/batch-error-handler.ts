/**
 * Unified batch error handling utility
 * Eliminates duplicate error handling code across components
 */

import type { BatchResult } from "../types/index.js";

export function batchSuccess<T>(url: string, data: T): BatchResult<T> {
	return { url, data };
}

export function batchFailure<T>(url: string, error: unknown): BatchResult<T> {
	const errorMessage = error instanceof Error ? error.message : "Unknown error";
	return { url, data: null, error: errorMessage };
}

export async function batchSafeExecute<T>(
	url: string,
	fn: () => Promise<T> | T,
): Promise<BatchResult<T>> {
	try {
		const data = await fn();
		return batchSuccess(url, data);
	} catch (error) {
		return batchFailure<T>(url, error);
	}
}

export function isPermanentError(error: string): boolean {
	return error.includes("PERMANENT_ERROR:");
}

export function extractPermanentErrorCode(error: string): string {
	const match = error.match(/PERMANENT_ERROR:(\d+):/);
	return match?.[1] || "unknown";
}

export const BatchErrorHandler = {
	success: batchSuccess,
	failure: batchFailure,
	safeExecute: batchSafeExecute,
	isPermanentError,
	extractPermanentErrorCode,
};
