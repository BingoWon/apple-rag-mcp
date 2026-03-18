import { IPAuthenticationService } from "../mcp-services/ip-authentication.js";
import type { AuthContext } from "../mcp-types/index.js";
import { logger } from "../mcp-utils/logger.js";
import { extractClientInfo } from "../mcp-utils/request-info.js";
import { TOKEN_FORMAT } from "../mcp/constants.js";
import { TokenValidator, type UserTokenData } from "./token-validator.js";

export class AuthMiddleware {
	private readonly tokenValidator: TokenValidator;
	private readonly ipAuthService: IPAuthenticationService;

	constructor(d1: D1Database) {
		this.tokenValidator = new TokenValidator(d1);
		this.ipAuthService = new IPAuthenticationService(d1);
	}

	private extractBearerToken(authHeader?: string): string | null {
		if (!authHeader) return null;
		const token = authHeader.replace(/^(Bearer\s+)+/gi, "").trim();
		return TOKEN_FORMAT.test(token) ? token : null;
	}

	async optionalAuth(request: Request): Promise<AuthContext> {
		const authHeader = request.headers.get("authorization");
		const token = this.extractBearerToken(authHeader || undefined);
		const { ip: clientIP } = extractClientInfo(request);

		// Try token authentication first
		if (token) {
			const validation = await this.tokenValidator.validateToken(token);

			if (validation.valid) {
				logger.info(`Token authentication successful for userId: ${validation.userData?.userId}`);

				return {
					isAuthenticated: true,
					userId: validation.userData?.userId,
					email: validation.userData?.email,
					token: token,
				};
			}

			logger.warn(
				`Token validation failed. Raw header: "${authHeader}", Extracted token: "${token}", IP: ${clientIP}, Error: ${validation.error}`,
			);
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
				token: "ip-based",
			};
		}

		// No authentication method succeeded
		logger.info(
			`No authentication provided - allowing unauthenticated access from IP: ${clientIP} (hasToken: ${!!token})`,
		);

		return { isAuthenticated: false };
	}

	async getUserData(userId: string): Promise<UserTokenData> {
		return this.tokenValidator.getUserDataById(userId);
	}
}
