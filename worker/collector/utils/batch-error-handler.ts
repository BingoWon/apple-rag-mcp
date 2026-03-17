/**
 * Unified batch error handling utility
 * Eliminates duplicate error handling code across components
 */

import type { BatchResult } from "../types/index.js";

export class BatchErrorHandler {
	/**
	 * Create successful batch result
	 */
	static success<T>(url: string, data: T): BatchResult<T> {
		return { url, data };
	}

	/**
	 * Create failed batch result
	 */
	static failure<T>(url: string, error: unknown): BatchResult<T> {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		return { url, data: null, error: errorMessage };
	}

	/**
	 * Safely execute function and return batch result
	 */
	static async safeExecute<T>(url: string, fn: () => Promise<T> | T): Promise<BatchResult<T>> {
		try {
			const data = await fn();
			return BatchErrorHandler.success(url, data);
		} catch (error) {
			return BatchErrorHandler.failure<T>(url, error);
		}
	}

	/**
	 * Check if error is permanent
	 */
	static isPermanentError(error: string): boolean {
		return error.includes("PERMANENT_ERROR:");
	}

	/**
	 * Extract permanent error status code
	 */
	static extractPermanentErrorCode(error: string): string {
		const match = error.match(/PERMANENT_ERROR:(\d+):/);
		return match?.[1] || "unknown";
	}
}
