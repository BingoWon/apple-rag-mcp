import { FREE_ACCESS_GUIDANCE, PRO_UPGRADE_GUIDANCE } from "../mcp/constants.js";
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

export function buildRateLimitMessage(
	rateLimitResult: RateLimitResult,
	authContext: AuthContext,
): string {
	const access = !authContext.isAuthenticated
		? "anonymous"
		: rateLimitResult.planType === "hobby"
			? "free plan"
			: `${rateLimitResult.planType} plan`;
	const guidance = !authContext.isAuthenticated
		? FREE_ACCESS_GUIDANCE
		: rateLimitResult.planType === "hobby"
			? PRO_UPGRADE_GUIDANCE
			: "";
	let message: string;

	if (rateLimitResult.limitType === "minute") {
		const resetTime = new Date(rateLimitResult.minuteResetAt!);
		const waitSeconds = Math.max(0, Math.ceil((resetTime.getTime() - Date.now()) / 1000));
		message = `Rate limit reached (${rateLimitResult.minuteLimit} tool calls/minute, ${access}). Retry in ${waitSeconds}s.`;
	} else {
		message = `Weekly quota exhausted (${rateLimitResult.limit.toLocaleString("en-US")} tool calls/week, ${access}). Quota resets at ${rateLimitResult.resetAt}.`;
	}

	return `${message}${guidance ? ` ${guidance}` : ""} Inform the user of this limit${guidance ? " and these options" : ""}.`;
}
