import { canonicalIP } from "../../shared/ip";
import { OAUTH_SUBSCRIPTION_QUOTAS } from "../api/types/permissions.js";
import type { AuthContext, RateLimitResult, SearchTrace } from "../services/types.js";
import { FREE_ACCESS_GUIDANCE, PRO_UPGRADE_GUIDANCE } from "./access-guidance.js";

export interface ClientInfo {
	ip: string;
	country: string | null;
}

/**
 * Extract client IP and country code from Cloudflare Worker request
 */
export function extractClientInfo(request: Request): ClientInfo {
	const ip = canonicalIP(request.headers.get("cf-connecting-ip")) ?? "unknown";
	const country = (request as Request & { cf?: { country?: string } }).cf?.country || null;
	return { ip, country };
}

export function searchTrace(request: Request, requestId: string): SearchTrace {
	const cf = request.cf;
	const ray = request.headers.get("cf-ray") ?? "";
	return {
		requestId,
		ray: /^[a-f0-9]{16}(?:-[A-Z]{3})?$/i.test(ray) ? ray : undefined,
		ingress: typeof cf?.colo === "string" && /^[A-Z]{3}$/.test(cf.colo) ? cf.colo : undefined,
		country:
			typeof cf?.country === "string" && /^[A-Z0-9]{2}$/.test(cf.country) ? cf.country : undefined,
	};
}

export function buildRateLimitMessage(
	rateLimitResult: RateLimitResult,
	authContext: AuthContext,
	channel: "mcp" | "cli" = "mcp",
): string {
	const access = !authContext.isAuthenticated
		? "anonymous"
		: rateLimitResult.planType === "hobby"
			? "free plan"
			: `${rateLimitResult.planType} plan`;
	const guidance = !authContext.isAuthenticated
		? channel === "cli"
			? `Run apple-rag auth login for a free account with ${OAUTH_SUBSCRIPTION_QUOTAS.hobby.week} tool calls/week and ${OAUTH_SUBSCRIPTION_QUOTAS.hobby.minute} tool calls/minute, shared by search, browse, and fetch.`
			: FREE_ACCESS_GUIDANCE
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
