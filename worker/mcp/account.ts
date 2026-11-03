import {
	type AccountStatus,
	accountSchema,
	LOGIN_URL,
	UPGRADE_URL,
} from "../../packages/cli/src/contracts.js";
import { AuthMiddleware, MCPAuthenticationError } from "../mcp-auth/auth-middleware.js";
import { RateLimitService } from "../mcp-services/rate-limit.js";
import type { AuthContext, RateLimitResult } from "../mcp-types/index.js";
import type { WaitUntilContext } from "../mcp-utils/d1-utils.js";
import { extractClientInfo } from "../mcp-utils/request-info.js";
import type { Env } from "../shared/types.js";

export function accountStatus(auth: AuthContext, quota: RateLimitResult): AccountStatus {
	const unlimited = (value: number) => (value === -1 ? null : value);
	return accountSchema.parse({
		authenticated: auth.isAuthenticated,
		auth_method: !auth.isAuthenticated ? "anonymous" : auth.token === "ip-based" ? "ip" : "token",
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
		login_url: LOGIN_URL,
		upgrade_url: UPGRADE_URL,
	});
}

export async function handleAccountRequest(
	request: Request,
	env: Env,
	ctx: WaitUntilContext,
): Promise<Response> {
	const headers = { "Cache-Control": "no-store", Vary: "Authorization" };
	try {
		const auth = await new AuthMiddleware(env.DB, ctx).optionalAuth(request);
		const quota = await new RateLimitService(env.DB).getStatus(extractClientInfo(request).ip, auth);
		const account = accountStatus(auth, quota);
		return Response.json(account, { headers });
	} catch (error) {
		const invalid = error instanceof MCPAuthenticationError;
		return Response.json(
			{
				error: {
					code: invalid ? "INVALID_TOKEN" : "SERVICE_UNAVAILABLE",
					message: invalid
						? "Invalid MCP Token. Sign in again."
						: "Account status is temporarily unavailable.",
				},
			},
			{ status: invalid ? 401 : 503, headers },
		);
	}
}
