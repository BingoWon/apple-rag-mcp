import { TOKEN_FORMAT } from "../mcp/constants.js";
import type { WaitUntilContext } from "../services/d1-utils.js";
import { IPAuthenticationService } from "../services/ip-authentication.js";
import { extractClientInfo } from "../services/request-info.js";
import type { AuthContext } from "../services/types.js";
import { logger } from "../shared/logger.js";
import { TokenValidator, type UserTokenData } from "./token-validator.js";

export class MCPAuthenticationError extends Error {
	constructor() {
		super("Invalid MCP token.");
	}
}

export class AuthMiddleware {
	private readonly tokenValidator: TokenValidator;
	private readonly ipAuthService: IPAuthenticationService;

	constructor(d1: D1Database, ctx: WaitUntilContext) {
		this.tokenValidator = new TokenValidator(d1, ctx);
		this.ipAuthService = new IPAuthenticationService(d1, ctx);
	}

	private extractBearerToken(authHeader?: string): string | null {
		if (!authHeader) return null;
		const token = /^Bearer ([^\s]+)$/i.exec(authHeader)?.[1];
		return token && TOKEN_FORMAT.test(token) ? token : null;
	}

	async optionalAuth(request: Request): Promise<AuthContext> {
		const authHeader = request.headers.get("authorization");
		const token = this.extractBearerToken(authHeader || undefined);
		const { ip: clientIP } = extractClientInfo(request);

		// Explicit credentials must never fall back to another identity.
		if (authHeader !== null) {
			if (!token) throw new MCPAuthenticationError();
			const validation = await this.tokenValidator.validateToken(token);

			if (validation.valid) {
				logger.info(`Token authentication successful for userId: ${validation.userData?.userId}`);

				return {
					isAuthenticated: true,
					userId: validation.userData?.userId,
					email: validation.userData?.email,
					credentialId: validation.userData?.credentialId,
					authMethod: "token",
				};
			}

			logger.warn("MCP token authentication rejected.");
			throw new MCPAuthenticationError();
		}

		// Try IP-based authentication
		const ipAuthResult = await this.ipAuthService.checkIPAuthentication(clientIP);
		if (ipAuthResult) {
			logger.info(
				`IP-based authentication successful for userId: ${ipAuthResult.userId} from IP: ${clientIP}`,
			);

			return {
				isAuthenticated: true,
				userId: ipAuthResult.userId,
				email: ipAuthResult.email,
				authMethod: "ip",
			};
		}

		// No authentication method succeeded
		logger.info(
			`No authentication provided - allowing unauthenticated access from IP: ${clientIP} (hasToken: ${!!token})`,
		);

		return { isAuthenticated: false, authMethod: "anonymous" };
	}

	async getUserData(userId: string): Promise<UserTokenData> {
		return this.tokenValidator.getUserDataById(userId);
	}
}
