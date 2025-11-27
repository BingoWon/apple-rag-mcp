/**
 * MCP Token Validator with D1 timeout protection
 */

import { backgroundD1Write, withD1Timeout } from "../utils/d1-utils.js";
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

  async validateToken(token: string): Promise<TokenValidationResult> {
    if (!/^at_[a-f0-9]{32}$/.test(token)) {
      return { valid: false, error: "Invalid token format" };
    }

    const userData = await withD1Timeout(
      () => this.queryUserByToken(token),
      null,
      "token_lookup"
    );

    if (!userData) {
      return { valid: false, error: "Token not found" };
    }

    backgroundD1Write(
      logger.getContext(),
      () => this.updateLastUsed(token),
      "token_last_used"
    );

    return { valid: true, userData };
  }

  private async queryUserByToken(token: string): Promise<UserTokenData | null> {
    const result = await this.d1
      .prepare(
        `SELECT u.id as user_id, u.email, u.name
         FROM mcp_tokens t JOIN users u ON t.user_id = u.id
         WHERE t.mcp_token = ?`
      )
      .bind(token)
      .all();

    if (!result.success || !result.results?.length) return null;

    const row = result.results[0] as Record<string, unknown>;
    return {
      userId: row.user_id as string,
      email: (row.email as string) || "unknown",
      name: (row.name as string) || "unknown",
    };
  }

  private async updateLastUsed(token: string): Promise<void> {
    await this.d1
      .prepare("UPDATE mcp_tokens SET last_used_at = ? WHERE mcp_token = ?")
      .bind(new Date().toISOString(), token)
      .run();
  }

  async getUserDataById(userId: string): Promise<UserTokenData> {
    const result = await withD1Timeout(
      async () => {
        const res = await this.d1
          .prepare("SELECT id, email, name FROM users WHERE id = ?")
          .bind(userId)
          .all();
        if (!res.success || !res.results?.length) throw new Error("User not found");
        const user = res.results[0] as Record<string, unknown>;
        return {
          userId: user.id as string,
          email: user.email as string,
          name: (user.name as string) || (user.email as string).split("@")[0],
        };
      },
      null,
      "user_lookup"
    );

    if (!result) throw new Error("User not found");
    return result;
  }
}
