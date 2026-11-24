import {
	type AccountStatus,
	accountSchema,
	LOGIN_URL,
	UPGRADE_URL,
} from "../../shared/contracts.js";
import type { AuthContext, RateLimitResult } from "./types.js";

export function accountStatus(
	auth: AuthContext,
	quota: RateLimitResult,
	channel: "mcp" | "cli" = "mcp",
): AccountStatus {
	const unlimited = (value: number) => (value === -1 ? null : value);
	return accountSchema.parse({
		authenticated: auth.isAuthenticated,
		auth_method: auth.authMethod ?? (auth.isAuthenticated ? "token" : "anonymous"),
		email: auth.email ?? null,
		plan: quota.planType,
		quota: {
			week: {
				limit: unlimited(quota.limit),
				remaining: unlimited(quota.remaining),
				reset_at: quota.resetAt,
			},
			minute: {
				limit: unlimited(quota.minuteLimit!),
				remaining: unlimited(quota.minuteRemaining!),
				reset_at: quota.minuteResetAt,
			},
		},
		login_url: channel === "cli" ? "https://apple-rag.com/login" : LOGIN_URL,
		upgrade_url: UPGRADE_URL,
	});
}
