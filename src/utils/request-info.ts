/**
 * Request Information Utilities
 * Extract client information from Cloudflare Worker requests
 */

import type { AuthContext, RateLimitResult } from "../types/index.js";

const SUBSCRIPTION_URL = "https://apple-rag.com";

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
  const country =
    (request as Request & { cf?: { country?: string } }).cf?.country || null;
  return { ip, country };
}

/**
 * Build rate limit error message based on limit type and auth context
 */
export function buildRateLimitMessage(
  rateLimitResult: RateLimitResult,
  authContext: AuthContext
): string {
  if (rateLimitResult.limitType === "minute") {
    const resetTime = new Date(rateLimitResult.minuteResetAt!);
    const waitSeconds = Math.ceil((resetTime.getTime() - Date.now()) / 1000);

    return authContext.isAuthenticated
      ? `Rate limit reached for ${rateLimitResult.planType} plan (${rateLimitResult.minuteLimit} queries per minute). Please wait ${waitSeconds} seconds before trying again.`
      : `Rate limit reached for anonymous access (${rateLimitResult.minuteLimit} query per minute). Please wait ${waitSeconds} seconds before trying again. Subscribe at ${SUBSCRIPTION_URL} for higher limits.`;
  }

  return authContext.isAuthenticated
    ? `Weekly limit reached for ${rateLimitResult.planType} plan (${rateLimitResult.limit} queries per week). Upgrade to Pro at ${SUBSCRIPTION_URL} for higher limits.`
    : `Weekly limit reached for anonymous access (${rateLimitResult.limit} queries per week). Subscribe at ${SUBSCRIPTION_URL} for higher limits.`;
}

