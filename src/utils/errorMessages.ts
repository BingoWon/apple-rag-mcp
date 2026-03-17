/**
 * Error message mapping utility
 * Converts technical error codes to user-friendly messages
 */

import i18n from "@/i18n";

export interface FriendlyError {
	title: string;
	message: string;
	suggestion?: string;
	action?: string;
}

interface ErrorKeyMapping {
	titleKey: string;
	messageKey: string;
	suggestionKey?: string;
}

const ERROR_KEY_MAP: Record<string, ErrorKeyMapping> = {
	INVALID_CREDENTIALS: {
		titleKey: "errors.invalid_credentials_title",
		messageKey: "errors.invalid_credentials",
		suggestionKey: "errors.invalid_credentials_suggestion",
	},
	TOKEN_EXPIRED: {
		titleKey: "errors.token_expired_title",
		messageKey: "errors.token_expired",
		suggestionKey: "errors.token_expired_suggestion",
	},
	INSUFFICIENT_PERMISSIONS: {
		titleKey: "errors.access_denied_title",
		messageKey: "errors.access_denied",
		suggestionKey: "errors.access_denied_suggestion",
	},
	USER_NOT_FOUND: {
		titleKey: "errors.user_not_found_title",
		messageKey: "errors.user_not_found",
		suggestionKey: "errors.user_not_found_suggestion",
	},
	EMAIL_ALREADY_EXISTS: {
		titleKey: "errors.email_taken_title",
		messageKey: "errors.email_taken",
		suggestionKey: "errors.email_taken_suggestion",
	},
	INVALID_REQUEST: {
		titleKey: "errors.invalid_request_title",
		messageKey: "errors.invalid_request",
		suggestionKey: "errors.invalid_request_suggestion",
	},
	RESOURCE_NOT_FOUND: {
		titleKey: "errors.not_found_title",
		messageKey: "errors.not_found",
		suggestionKey: "errors.not_found_suggestion",
	},
	RESOURCE_ALREADY_EXISTS: {
		titleKey: "errors.already_exists_title",
		messageKey: "errors.already_exists",
		suggestionKey: "errors.already_exists_suggestion",
	},
	QUOTA_EXCEEDED: {
		titleKey: "errors.quota_exceeded_title",
		messageKey: "errors.quota_exceeded",
		suggestionKey: "errors.quota_exceeded_suggestion",
	},
	RATE_LIMIT_EXCEEDED: {
		titleKey: "errors.rate_limit_title",
		messageKey: "errors.rate_limit",
		suggestionKey: "errors.rate_limit_suggestion",
	},
	INTERNAL_ERROR: {
		titleKey: "errors.server_error_title",
		messageKey: "errors.server_error",
		suggestionKey: "errors.server_error_suggestion",
	},
	NETWORK_ERROR: {
		titleKey: "errors.network_error_title",
		messageKey: "errors.network_error",
		suggestionKey: "errors.network_error_suggestion",
	},
	TIMEOUT_ERROR: {
		titleKey: "errors.timeout_title",
		messageKey: "errors.timeout",
		suggestionKey: "errors.timeout_suggestion",
	},
	INVALID_MCP_TOKEN: {
		titleKey: "errors.invalid_token_title",
		messageKey: "errors.invalid_token",
		suggestionKey: "errors.invalid_token_suggestion",
	},
	MCP_TOKEN_EXPIRED: {
		titleKey: "errors.mcp_token_expired_title",
		messageKey: "errors.mcp_token_expired",
		suggestionKey: "errors.mcp_token_expired_suggestion",
	},
	SEARCH_FAILED: {
		titleKey: "errors.search_failed_title",
		messageKey: "errors.search_failed",
		suggestionKey: "errors.search_failed_suggestion",
	},
	EMPTY_QUERY: {
		titleKey: "errors.empty_query_title",
		messageKey: "errors.empty_query",
		suggestionKey: "errors.empty_query_suggestion",
	},
	PAYMENT_FAILED: {
		titleKey: "errors.payment_failed_title",
		messageKey: "errors.payment_failed",
		suggestionKey: "errors.payment_failed_suggestion",
	},
	SUBSCRIPTION_EXPIRED: {
		titleKey: "errors.subscription_expired_title",
		messageKey: "errors.subscription_expired",
		suggestionKey: "errors.subscription_expired_suggestion",
	},
	OAUTH_FAILED: {
		titleKey: "errors.oauth_failed_title",
		messageKey: "errors.oauth_failed",
		suggestionKey: "errors.oauth_failed_suggestion",
	},
	OAUTH_CANCELLED: {
		titleKey: "errors.oauth_cancelled_title",
		messageKey: "errors.oauth_cancelled",
		suggestionKey: "errors.oauth_cancelled_suggestion",
	},
	EMAIL_NOT_VERIFIED: {
		titleKey: "errors.email_not_verified_title",
		messageKey: "errors.email_not_verified",
		suggestionKey: "errors.email_not_verified_suggestion",
	},
	VERIFICATION_FAILED: {
		titleKey: "errors.verification_failed_title",
		messageKey: "errors.verification_failed",
		suggestionKey: "errors.verification_failed_suggestion",
	},
};

function resolveError(mapping: ErrorKeyMapping): FriendlyError {
	return {
		title: i18n.t(mapping.titleKey),
		message: i18n.t(mapping.messageKey),
		suggestion: mapping.suggestionKey ? i18n.t(mapping.suggestionKey) : undefined,
	};
}

/**
 * Convert technical error codes to user-friendly error messages
 * @param errorCode Technical error code
 * @param fallbackMessage Fallback error message
 * @returns Friendly error message object
 */
export function getFriendlyError(
	errorCode: string | undefined,
	fallbackMessage?: string,
): FriendlyError {
	// Return mapped error if available
	if (errorCode && ERROR_KEY_MAP[errorCode]) {
		return resolveError(ERROR_KEY_MAP[errorCode]);
	}

	// Try to infer from common error patterns
	const lowerCode = errorCode?.toLowerCase() || "";
	const lowerFallback = fallbackMessage?.toLowerCase() || "";

	// Login-related error inference
	if (
		lowerCode.includes("credential") ||
		lowerCode.includes("login") ||
		lowerFallback.includes("credential") ||
		lowerFallback.includes("login")
	) {
		return resolveError(ERROR_KEY_MAP.INVALID_CREDENTIALS);
	}

	// Token-related error inference
	if (
		lowerCode.includes("token") ||
		lowerCode.includes("expired") ||
		lowerFallback.includes("token") ||
		lowerFallback.includes("expired")
	) {
		return resolveError(ERROR_KEY_MAP.TOKEN_EXPIRED);
	}

	// Permission-related error inference
	if (
		lowerCode.includes("permission") ||
		lowerCode.includes("unauthorized") ||
		lowerFallback.includes("permission") ||
		lowerFallback.includes("unauthorized")
	) {
		return resolveError(ERROR_KEY_MAP.INSUFFICIENT_PERMISSIONS);
	}

	// Network-related error inference
	if (
		lowerCode.includes("network") ||
		lowerCode.includes("connection") ||
		lowerFallback.includes("network") ||
		lowerFallback.includes("connection")
	) {
		return resolveError(ERROR_KEY_MAP.NETWORK_ERROR);
	}

	// Default generic error message
	return {
		title: i18n.t("errors.generic_title"),
		message: fallbackMessage || i18n.t("errors.generic"),
		suggestion: i18n.t("errors.generic_suggestion"),
	};
}

/**
 * Get simplified error message (main message only)
 * @param errorCode Technical error code
 * @param fallbackMessage Fallback error message
 * @returns Simplified error message string
 */
export function getFriendlyErrorMessage(
	errorCode: string | undefined,
	fallbackMessage?: string,
): string {
	const friendlyError = getFriendlyError(errorCode, fallbackMessage);
	return friendlyError.message;
}

/**
 * Get complete error message (including suggestions and actions)
 * @param errorCode Technical error code
 * @param fallbackMessage Fallback error message
 * @returns Complete error message string
 */
export function getFullErrorMessage(
	errorCode: string | undefined,
	fallbackMessage?: string,
): string {
	const friendlyError = getFriendlyError(errorCode, fallbackMessage);
	let message = friendlyError.message;

	if (friendlyError.suggestion) {
		message += `\n\n${friendlyError.suggestion}`;
	}

	return message;
}

/**
 * Check if error is critical (requires special handling)
 * @param errorCode Error code
 * @returns Whether the error is critical
 */
export function isCriticalError(errorCode: string | undefined): boolean {
	const criticalErrors = ["INTERNAL_ERROR", "NETWORK_ERROR", "TIMEOUT_ERROR", "PAYMENT_FAILED"];

	return errorCode ? criticalErrors.includes(errorCode) : false;
}

/**
 * Get suggested action for error
 * @param errorCode Error code
 * @returns Suggested action text
 */
export function getErrorAction(errorCode: string | undefined): string | undefined {
	const friendlyError = getFriendlyError(errorCode);
	return friendlyError.action;
}
