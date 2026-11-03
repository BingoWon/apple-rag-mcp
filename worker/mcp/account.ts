import { AuthMiddleware, MCPAuthenticationError } from "../mcp-auth/auth-middleware.js";
import { accountStatus } from "../services/account.js";
import type { WaitUntilContext } from "../services/d1-utils.js";
import { RateLimitService } from "../services/rate-limit.js";
import { extractClientInfo } from "../services/request-info.js";
import type { Env } from "../shared/types.js";
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
