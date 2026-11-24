import i18n from "@/i18n";
import type { User } from "@/types";
import { copyText } from "@/utils/clipboard";

export const MCP_TOKEN_DISPLAY_CONFIG = {
	visibleLength: 16, // Show first 16 characters for better identification
	maskChar: "•", // Use bullet character for better visual appearance
} as const;

export const maskMcpToken = (mcpToken: string, config = MCP_TOKEN_DISPLAY_CONFIG): string => {
	const { visibleLength, maskChar } = config;

	if (mcpToken.length <= visibleLength) {
		return mcpToken;
	}

	const visiblePart = mcpToken.substring(0, visibleLength);
	const maskedPart = maskChar.repeat(mcpToken.length - visibleLength);

	return `${visiblePart}${maskedPart}`;
};

export const getMcpTokenDisplayText = (mcpToken: string, isVisible: boolean): string => {
	return isVisible ? mcpToken : maskMcpToken(mcpToken);
};

export const copyMcpTokenToClipboard = async (
	mcpToken: string,
	onSuccess?: (message: string) => void,
	onError?: (message: string) => void,
): Promise<void> => {
	try {
		await copyText(mcpToken);
		onSuccess?.(i18n.t("tokens.copied_success"));
	} catch (_error) {
		onError?.(i18n.t("tokens.copy_error"));
	}
};

// JWT token utilities for OAuth authentication
export interface JWTPayload {
	sub: string; // user id
	email: string;
	name?: string;
	avatar?: string; // user avatar
	created_at?: string; // user creation date
	plan_type: string; // subscription plan (required, matches backend)
	permissions: string[]; // permissions list (required, matches backend)
	iat: number; // issued at
	exp: number; // expires at
	jti: string; // JWT ID
}

/**
 * Parse JWT token and extract payload (OAuth optimized)
 */
export const parseJWTToken = (jwtToken: string): JWTPayload => {
	try {
		const [, payload] = jwtToken.split(".");
		if (!payload) throw new Error("Invalid JWT format");

		const decoded = new TextDecoder().decode(
			Uint8Array.from(atob(payload.replace(/-/g, "+").replace(/_/g, "/")), (char) =>
				char.charCodeAt(0),
			),
		);
		return JSON.parse(decoded) as JWTPayload;
	} catch (error) {
		throw new Error(
			`Invalid JWT token: ${error instanceof Error ? error.message : "Parse failed"}`,
		);
	}
};

/**
 * Check if JWT token is expired
 */
export const isJWTTokenExpired = (jwtToken: string): boolean => {
	try {
		const { exp } = parseJWTToken(jwtToken);
		return !Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000);
	} catch {
		return true;
	}
};

/**
 * Extract user information from JWT token (OAuth optimized)
 */
export const extractUserFromJWTToken = (jwtToken: string): User => {
	const { sub, email, name, avatar, created_at, plan_type, permissions } = parseJWTToken(jwtToken);

	return {
		id: sub,
		email,
		name: name ?? email.split("@")[0],
		avatar,
		tier: (plan_type as "free" | "pro" | "enterprise") ?? "free",
		created_at: created_at ?? new Date().toISOString(),
		permissions: permissions ?? [],
	};
};
