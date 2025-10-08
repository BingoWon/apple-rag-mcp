/**
 * Simple MCP Token Validator
 * Validates MCP tokens against Cloudflare D1 database
 */

import { logger } from "../utils/logger.js";

export interface TokenValidationResult {
  valid: boolean;
  error?: string;
  userData?: UserTokenData;
}

export interface UserTokenData {
  userId: string;
  email: string;
  name: string;
}

export class TokenValidator {
  constructor(private d1: D1Database) {}

  /**
   * Validate MCP token
   */
  async validateToken(token: string): Promise<TokenValidationResult> {
    try {
      // Validate token format
      if (!this.isValidTokenFormat(token)) {
        return { valid: false, error: "Invalid token format" };
      }

      // Query database directly
      const userData = await this.getUserDataFromD1(token);
      if (!userData) {
        return { valid: false, error: "Token not found" };
      }

      // Update token last used
      await this.updateTokenLastUsedAsync(token);

      return { valid: true, userData };
    } catch (error) {
      logger.error(
        `Token validation exception for token "${token}": ${error instanceof Error ? error.message : String(error)}`
      );
      return { valid: false, error: "Validation failed" };
    }
  }

  /**
   * Modern token format validation
   */
  private isValidTokenFormat(token: string): boolean {
    return /^at_[a-f0-9]{32}$/.test(token);
  }

  /**
   * Get user data from D1 database
   */
  private async getUserDataFromD1(
    token: string
  ): Promise<UserTokenData | null> {
    try {
      const result = await this.d1
        .prepare(
          `SELECT
           u.id as user_id,
           u.email,
           u.name
         FROM mcp_tokens t
         JOIN users u ON t.user_id = u.id
         WHERE t.mcp_token = ?`
        )
        .bind(token)
        .all();

      if (!result.success || !result.results || result.results.length === 0) {
        return null;
      }

      const row = result.results[0] as Record<string, unknown>;
      return {
        userId: row.user_id as string,
        email: (row.email as string) || "unknown",
        name: (row.name as string) || "unknown",
      };
    } catch (error) {
      logger.warn(
        `D1 user data lookup failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  /**
   * Non-blocking token usage update
   */
  private async updateTokenLastUsedAsync(token: string): Promise<void> {
    try {
      logger.info(
        `🚀 Starting token last_used_at update for ${token.substring(0, 8)}...`
      );

      const result = await this.d1
        .prepare("UPDATE mcp_tokens SET last_used_at = ? WHERE mcp_token = ?")
        .bind(new Date().toISOString(), token)
        .run();

      if (!result.success) {
        throw new Error("D1 token update execution failed");
      }

      logger.info(
        `✅ Token last_used_at update completed successfully for ${token.substring(0, 8)}... (success: ${result.success})`
      );
    } catch (error) {
      logger.error(
        `❌ Failed to update token last_used_at for ${token.substring(0, 8)}...: ${error instanceof Error ? error.message : String(error)}`
      );
      // 不重新抛出错误，避免影响主流程
    }
  }

  /**
   * Get user data by user ID
   */
  async getUserData(userId: string): Promise<UserTokenData> {
    try {
      const result = await this.d1
        .prepare("SELECT id, email, name FROM users WHERE id = ?")
        .bind(userId)
        .all();

      if (!result.success || !result.results || result.results.length === 0) {
        throw new Error("User not found");
      }

      const user = result.results[0] as Record<string, unknown>;

      return {
        userId: user.id as string,
        email: user.email as string,
        name: (user.name as string) || (user.email as string).split("@")[0],
      };
    } catch (error) {
      logger.error(
        `Failed to get user data for userId ${userId}: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }
}
