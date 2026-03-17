/**
 * Error message mapping utility
 * Converts technical error codes to user-friendly messages
 */

export interface FriendlyError {
	title: string;
	message: string;
	suggestion?: string;
	action?: string;
}

/**
 * Error code to friendly message mapping
 */
const ERROR_MESSAGES: Record<string, FriendlyError> = {
	// Authentication errors
	INVALID_CREDENTIALS: {
		title: "Login Failed",
		message: "Invalid email or password",
		suggestion: "Please check your credentials and try again",
		action: "Retry",
	},

	TOKEN_EXPIRED: {
		title: "Session Expired",
		message: "Your session has expired",
		suggestion: "Please log in again to continue",
		action: "Login",
	},

	INSUFFICIENT_PERMISSIONS: {
		title: "Access Denied",
		message: "You don't have permission for this action",
		suggestion: "Contact support or upgrade your plan",
		action: "Contact Support",
	},

	USER_NOT_FOUND: {
		title: "User Not Found",
		message: "No account found with this email",
		suggestion: "Check your email or create an account",
		action: "Sign Up",
	},

	EMAIL_ALREADY_EXISTS: {
		title: "Email Taken",
		message: "This email is already registered",
		suggestion: "Use a different email or reset password",
		action: "Reset Password",
	},

	// Request errors
	INVALID_REQUEST: {
		title: "Invalid Request",
		message: "The request format is incorrect",
		suggestion: "Please check your input and try again",
		action: "Retry",
	},

	RESOURCE_NOT_FOUND: {
		title: "Not Found",
		message: "The requested resource was not found",
		suggestion: "Check the URL or return to homepage",
		action: "Go Home",
	},

	RESOURCE_ALREADY_EXISTS: {
		title: "Already Exists",
		message: "This resource already exists",
		suggestion: "Use a different name or check for duplicates",
		action: "Try Different Name",
	},

	// Quota and rate limiting errors
	QUOTA_EXCEEDED: {
		title: "Quota Exceeded",
		message: "You've reached your usage limit",
		suggestion: "Upgrade your plan for more usage",
		action: "Upgrade Plan",
	},

	RATE_LIMIT_EXCEEDED: {
		title: "Too Many Requests",
		message: "Please slow down and try again",
		suggestion: "Wait a moment before making more requests",
		action: "Wait and Retry",
	},

	// System errors
	INTERNAL_ERROR: {
		title: "Server Error",
		message: "Something went wrong on our end",
		suggestion: "Please try again or contact support",
		action: "Contact Support",
	},

	NETWORK_ERROR: {
		title: "Connection Error",
		message: "Unable to connect to server",
		suggestion: "Check your internet connection",
		action: "Retry",
	},

	TIMEOUT_ERROR: {
		title: "Request Timeout",
		message: "The request took too long",
		suggestion: "Please try again",
		action: "Retry",
	},

	// MCP Token errors
	INVALID_MCP_TOKEN: {
		title: "Invalid Token",
		message: "Your MCP token is invalid or expired",
		suggestion: "Generate a new token",
		action: "Generate Token",
	},

	MCP_TOKEN_EXPIRED: {
		title: "Token Expired",
		message: "Your MCP token has expired",
		suggestion: "Generate a new token to continue",
		action: "Generate New Token",
	},

	// Search errors
	SEARCH_FAILED: {
		title: "Search Failed",
		message: "Search service is temporarily unavailable",
		suggestion: "Please try again later",
		action: "Retry Search",
	},

	EMPTY_QUERY: {
		title: "Empty Search",
		message: "Please enter a search query",
		suggestion: "Type keywords to search",
		action: "Enter Keywords",
	},

	// Payment errors
	PAYMENT_FAILED: {
		title: "Payment Failed",
		message: "Payment could not be processed",
		suggestion: "Check your payment details and try again",
		action: "Retry Payment",
	},

	SUBSCRIPTION_EXPIRED: {
		title: "Subscription Expired",
		message: "Your subscription has expired",
		suggestion: "Renew to continue using all features",
		action: "Renew Now",
	},

	// OAuth errors
	OAUTH_FAILED: {
		title: "OAuth Failed",
		message: "Third-party login is temporarily unavailable",
		suggestion: "Try email login instead",
		action: "Use Email Login",
	},

	OAUTH_CANCELLED: {
		title: "Login Cancelled",
		message: "You cancelled the login process",
		suggestion: "Try again or use a different method",
		action: "Try Again",
	},

	// Verification errors
	EMAIL_NOT_VERIFIED: {
		title: "Email Not Verified",
		message: "Please verify your email address",
		suggestion: "Check your inbox for verification link",
		action: "Resend Email",
	},

	VERIFICATION_FAILED: {
		title: "Verification Failed",
		message: "Verification link is invalid or expired",
		suggestion: "Request a new verification email",
		action: "Resend",
	},
};

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
	if (errorCode && ERROR_MESSAGES[errorCode]) {
		return ERROR_MESSAGES[errorCode];
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
		return ERROR_MESSAGES.INVALID_CREDENTIALS;
	}

	// Token-related error inference
	if (
		lowerCode.includes("token") ||
		lowerCode.includes("expired") ||
		lowerFallback.includes("token") ||
		lowerFallback.includes("expired")
	) {
		return ERROR_MESSAGES.TOKEN_EXPIRED;
	}

	// Permission-related error inference
	if (
		lowerCode.includes("permission") ||
		lowerCode.includes("unauthorized") ||
		lowerFallback.includes("permission") ||
		lowerFallback.includes("unauthorized")
	) {
		return ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS;
	}

	// Network-related error inference
	if (
		lowerCode.includes("network") ||
		lowerCode.includes("connection") ||
		lowerFallback.includes("network") ||
		lowerFallback.includes("connection")
	) {
		return ERROR_MESSAGES.NETWORK_ERROR;
	}

	// Default generic error message
	return {
		title: "Error",
		message: fallbackMessage || "Something went wrong",
		suggestion: "Please try again or contact support",
		action: "Retry",
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
