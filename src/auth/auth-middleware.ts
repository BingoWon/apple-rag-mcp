/**
 * Simple MCP Authentication Middleware
 */

import { IPAuthenticationService } from "../services/ip-authentication.js";
import type { AuthContext } from "../types/index.js";
import { logger } from "../utils/logger.js";
import { TokenValidator, type UserTokenData } from "./token-validator.js";

export class AuthMiddleware {
  private readonly tokenValidator: TokenValidator;
  private readonly ipAuthService: IPAuthenticationService;

  constructor(d1: D1Database) {
    this.tokenValidator = new TokenValidator(d1);
    this.ipAuthService = new IPAuthenticationService(d1);
  }

  /**
   * Extract Bearer token from Authorization header
   * Handles multiple "Bearer" prefixes and validates token format
   */
  private extractBearerToken(authHeader?: string): string | null {
    if (!authHeader) return null;

    // Remove all "Bearer " prefixes (case-insensitive, supports multiple)
    const token = authHeader.replace(/^(Bearer\s+)+/gi, "").trim();

    // Only return if it matches valid token format
    return /^at_[a-f0-9]{32}$/.test(token) ? token : null;
  }

  /**
   * Optional authentication middleware
   * Validates token if present, or checks IP-based authentication, allows access without either
   */
  async optionalAuth(request: Request): Promise<AuthContext> {
    const authHeader = request.headers.get("authorization");
    const token = this.extractBearerToken(authHeader || undefined);
    const clientIP = this.getClientIP(request);

    // Try token authentication first
    if (token) {
      const validation = await this.tokenValidator.validateToken(token);

      if (validation.valid) {
        logger.info(
          `Token authentication successful for userId: ${validation.userData?.userId}`
        );

        return {
          isAuthenticated: true,
          userId: validation.userData?.userId,
          email: validation.userData?.email,
          token: token,
        };
      }

      logger.error(
        `Token validation failed. Raw header: "${authHeader}", Extracted token: "${token}", IP: ${clientIP}, Error: ${validation.error}`
      );
    }

    // Try IP-based authentication
    const ipAuthResult =
      await this.ipAuthService.checkIPAuthentication(clientIP);
    if (ipAuthResult) {
      logger.info(
        `IP-based authentication successful for userId: ${ipAuthResult.userId} from IP: ${clientIP}`
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
      `No authentication provided - allowing unauthenticated access from IP: ${clientIP} (hasToken: ${!!token})`
    );

    return { isAuthenticated: false };
  }

  /**
   * Get user data by user ID
   */
  async getUserData(userId: string): Promise<UserTokenData> {
    return await this.tokenValidator.getUserData(userId);
  }

  /**
   * Get client IP address from request (Worker optimized)
   */
  private getClientIP(request: Request): string {
    // Cloudflare provides client IP in CF-Connecting-IP header
    return (
      request.headers.get("CF-Connecting-IP") ||
      request.headers.get("X-Forwarded-For") ||
      request.headers.get("X-Real-IP") ||
      "unknown"
    );
  }
}
