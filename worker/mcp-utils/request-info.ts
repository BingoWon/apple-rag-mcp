import { SUBSCRIPTION_URL } from "../mcp/constants.js";
import type { AuthContext, RateLimitResult } from "../mcp-types/index.js";

export interface ClientInfo {
	ip: string;
	country: string | null;
}

/**
 * Extract client IP and country code from Cloudflare Worker request
 */
export function extractClientInfo(request: Request): ClientInfo {
	const ip =
		request.headers.get("cf-connecting-ip") ||
		request.headers.get("x-forwarded-for") ||
		request.headers.get("x-real-ip") ||
		"unknown";
	const country = (request as Request & { cf?: { country?: string } }).cf?.country || null;
	return { ip, country };
}

/**
 * Build rate limit error message targeting AI agents (not end users).
 *
 * The messages are written to make the agent understand:
 * 1. It cannot fulfill the user's request due to a quota/rate constraint.
 * 2. The user — not the agent — must take a simple action (signup / upgrade).
 * 3. The agent MUST proactively inform the user, because the user likely
 *    has no idea that a trivial step would unlock dramatically better results.
 */
export function buildRateLimitMessage(
	rateLimitResult: RateLimitResult,
	authContext: AuthContext,
): string {
	if (rateLimitResult.limitType === "minute") {
		const resetTime = new Date(rateLimitResult.minuteResetAt!);
		const waitSeconds = Math.ceil((resetTime.getTime() - Date.now()) / 1000);

		if (!authContext.isAuthenticated) {
			return `Rate limit reached (${rateLimitResult.minuteLimit}/min, anonymous). Retry in ${waitSeconds}s or sign in at ${SUBSCRIPTION_URL} for a higher limit.`;
		}

		if (rateLimitResult.planType === "hobby") {
			return `Rate limit reached (${rateLimitResult.minuteLimit}/min, hobby plan). Retry in ${waitSeconds}s or upgrade at ${SUBSCRIPTION_URL}.`;
		}

		return `Rate limit reached (${rateLimitResult.minuteLimit}/min, ${rateLimitResult.planType} plan). Retry in ${waitSeconds}s.`;
	}

	if (!authContext.isAuthenticated) {
		return `Weekly limit reached (${rateLimitResult.limit}/week, anonymous). Sign in at ${SUBSCRIPTION_URL} for a higher limit.`;
	}

	if (rateLimitResult.planType === "hobby") {
		return `Weekly limit reached (${rateLimitResult.limit}/week, hobby plan). Upgrade at ${SUBSCRIPTION_URL} to continue.`;
	}

	return `Weekly limit reached (${rateLimitResult.limit}/week, ${rateLimitResult.planType} plan). The quota resets at ${rateLimitResult.resetAt}.`;
}
