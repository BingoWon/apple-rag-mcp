import { isValidAppleUrl, normalizeAppleUrl } from "../shared/url-utils.js";

export interface UrlValidationResult {
	isValid: boolean;
	normalizedUrl: string;
	error?: string;
}

export function validateAndNormalizeUrl(url: string): UrlValidationResult {
	if (!url || typeof url !== "string" || url.trim().length === 0) {
		return { isValid: false, normalizedUrl: url, error: "URL is required" };
	}

	if (!isValidAppleUrl(url)) {
		return { isValid: false, normalizedUrl: url, error: "URL contains malformed patterns" };
	}

	try {
		return { isValid: true, normalizedUrl: normalizeAppleUrl(url) };
	} catch {
		return { isValid: false, normalizedUrl: url, error: "Invalid URL format" };
	}
}
