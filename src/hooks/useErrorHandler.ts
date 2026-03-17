/**
 * Global error handling hook
 * Provides unified error handling and user-friendly error messages
 */

import { useCallback } from "react";
import toast from "react-hot-toast";
import { getFriendlyError, getFriendlyErrorMessage, isCriticalError } from "@/utils/errorMessages";

export interface ErrorHandlerOptions {
	/** Whether to show toast notification */
	showToast?: boolean;
	/** Custom error title */
	title?: string;
	/** Whether to log error to console */
	logError?: boolean;
	/** Error callback function */
	onError?: (error: Error, friendlyError: ReturnType<typeof getFriendlyError>) => void;
}

/**
 * Error handling hook
 * @param defaultOptions Default options
 * @returns Error handling functions
 */
export function useErrorHandler(defaultOptions: ErrorHandlerOptions = {}) {
	const handleError = useCallback(
		(error: unknown, options: ErrorHandlerOptions = {}) => {
			const finalOptions = { ...defaultOptions, ...options };
			const { showToast = true, title, logError = true, onError } = finalOptions;

			// Extract error information
			let errorCode: string | undefined;
			let errorMessage: string;
			let actualError: Error;

			if (error instanceof Error) {
				actualError = error;
				errorMessage = error.message;

				// Try to extract error code from error message
				const codeMatch = errorMessage.match(/^([A-Z_]+):/);
				if (codeMatch) {
					errorCode = codeMatch[1];
					// Remove error code prefix, keep only message part
					errorMessage = errorMessage.replace(/^[A-Z_]+:\s*/, "");
				}
			} else if (typeof error === "string") {
				errorMessage = error;
				actualError = new Error(error);
			} else {
				errorMessage = "An unknown error occurred";
				actualError = new Error(errorMessage);
			}

			// Get friendly error information
			const friendlyError = getFriendlyError(errorCode, errorMessage);

			// Log error to console
			if (logError) {
				console.error("Error handled by useErrorHandler:", {
					originalError: error,
					errorCode,
					errorMessage,
					friendlyError,
					timestamp: new Date().toISOString(),
				});
			}

			// Show toast notification
			if (showToast) {
				const toastTitle = title || friendlyError.title;
				const toastMessage = `${toastTitle}\n${friendlyError.message}`;

				if (isCriticalError(errorCode)) {
					toast.error(toastMessage, {
						duration: 6000, // Critical errors show longer
					});
				} else {
					toast.error(toastMessage);
				}
			}

			// Call custom error callback
			if (onError) {
				onError(actualError, friendlyError);
			}

			return friendlyError;
		},
		[defaultOptions],
	);

	/**
	 * 处理 API 响应错误
	 * @param response API 响应对象
	 * @param options 错误处理选项
	 */
	const handleApiError = useCallback(
		(
			response: {
				success: boolean;
				error?: { code?: string; message?: string };
			},
			options: ErrorHandlerOptions = {},
		) => {
			if (!response.success && response.error) {
				const errorCode = response.error.code;
				const errorMessage = response.error.message || "API request failed";

				return handleError(errorCode ? `${errorCode}: ${errorMessage}` : errorMessage, options);
			}

			return null;
		},
		[handleError],
	);

	/**
	 * 处理网络错误
	 * @param error 网络错误
	 * @param options 错误处理选项
	 */
	const handleNetworkError = useCallback(
		(error: unknown, options: ErrorHandlerOptions = {}) => {
			let errorCode = "NETWORK_ERROR";
			let errorMessage = "Network connection failed";

			if (error instanceof Error) {
				if (error.message.includes("timeout")) {
					errorCode = "TIMEOUT_ERROR";
					errorMessage = "Request timeout";
				} else if (error.message.includes("fetch")) {
					errorCode = "NETWORK_ERROR";
					errorMessage = "Network connection failed";
				}
			}

			return handleError(`${errorCode}: ${errorMessage}`, options);
		},
		[handleError],
	);

	/**
	 * 处理表单验证错误
	 * @param errors 表单错误对象
	 * @param options 错误处理选项
	 */
	const handleFormErrors = useCallback(
		(errors: Record<string, { message?: string }>, options: ErrorHandlerOptions = {}) => {
			const errorMessages = Object.values(errors)
				.map((error) => error.message)
				.filter(Boolean)
				.join(", ");

			if (errorMessages) {
				return handleError(`INVALID_REQUEST: ${errorMessages}`, {
					title: "Form Validation Failed",
					...options,
				});
			}

			return null;
		},
		[handleError],
	);

	return {
		handleError,
		handleApiError,
		handleNetworkError,
		handleFormErrors,
		getFriendlyErrorMessage: (errorCode?: string, fallback?: string) =>
			getFriendlyErrorMessage(errorCode, fallback),
	};
}

/**
 * Simplified error handling hook, returns only the handler function
 */
export function useSimpleErrorHandler() {
	const { handleError } = useErrorHandler();
	return handleError;
}

/**
 * API error handling hook, specialized for handling API responses
 */
export function useApiErrorHandler() {
	const { handleApiError, handleNetworkError } = useErrorHandler();

	return {
		handleApiError,
		handleNetworkError,
	};
}
