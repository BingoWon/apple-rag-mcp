import { useCallback } from "react";
import toast from "react-hot-toast";
import { getFriendlyError, isCriticalError } from "@/utils/errorMessages";

export interface ErrorHandlerOptions {
	showToast?: boolean;
	title?: string;
	logError?: boolean;
	onError?: (error: Error, friendlyError: ReturnType<typeof getFriendlyError>) => void;
}

export function useErrorHandler(defaultOptions: ErrorHandlerOptions = {}) {
	const handleError = useCallback(
		(error: unknown, options: ErrorHandlerOptions = {}) => {
			const finalOptions = { ...defaultOptions, ...options };
			const { showToast = true, title, logError = true, onError } = finalOptions;

			let errorCode: string | undefined;
			let errorMessage: string;
			let actualError: Error;

			if (error instanceof Error) {
				actualError = error;
				errorMessage = error.message;

				const codeMatch = errorMessage.match(/^([A-Z_]+):/);
				if (codeMatch) {
					errorCode = codeMatch[1];
					errorMessage = errorMessage.replace(/^[A-Z_]+:\s*/, "");
				}
			} else if (typeof error === "string") {
				errorMessage = error;
				actualError = new Error(error);
			} else {
				errorMessage = "An unknown error occurred";
				actualError = new Error(errorMessage);
			}

			const friendlyError = getFriendlyError(errorCode, errorMessage);

			if (logError) {
				console.error("Error handled:", {
					originalError: error,
					errorCode,
					errorMessage,
					friendlyError,
				});
			}

			if (showToast) {
				const toastTitle = title || friendlyError.title;
				const toastMessage = `${toastTitle}\n${friendlyError.message}`;

				if (isCriticalError(errorCode)) {
					toast.error(toastMessage, { duration: 6000 });
				} else {
					toast.error(toastMessage);
				}
			}

			if (onError) {
				onError(actualError, friendlyError);
			}

			return friendlyError;
		},
		[defaultOptions],
	);

	return { handleError };
}
