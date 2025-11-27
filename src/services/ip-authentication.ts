/**
 * IP Authentication Service with D1 timeout protection
 */

import type { UserTokenData } from "../auth/token-validator.js";
import { backgroundD1Write, withD1Timeout } from "../utils/d1-utils.js";
import { logger } from "../utils/logger.js";

interface UserRecord {
  user_id: string;
  email?: string;
  name?: string;
}

export class IPAuthenticationService {
  constructor(private d1: D1Database) {}

  async checkIPAuthentication(clientIP: string): Promise<UserTokenData | null> {
    const user = await withD1Timeout(
      () => this.queryIP(clientIP),
      null,
      "ip_auth"
    );

    if (!user) return null;

    backgroundD1Write(
      logger.getContext(),
      () => this.updateLastUsed(clientIP, user.user_id),
      "ip_last_used"
    );

    return {
      userId: user.user_id,
      email: user.email || "ip-authenticated",
      name: user.name || "IP User",
    };
  }

  private async queryIP(clientIP: string): Promise<UserRecord | null> {
    const result = await this.d1
      .prepare(
        `SELECT uai.user_id, u.email, u.name
         FROM user_authorized_ips uai
         JOIN users u ON uai.user_id = u.id
         WHERE uai.ip_address = ?`
      )
      .bind(clientIP)
      .all();

    return (result.results?.[0] as unknown as UserRecord | undefined) ?? null;
  }

  private async updateLastUsed(ipAddress: string, userId: string): Promise<void> {
    await this.d1
      .prepare(
        "UPDATE user_authorized_ips SET last_used_at = ? WHERE ip_address = ? AND user_id = ?"
      )
      .bind(new Date().toISOString(), ipAddress, userId)
      .run();
  }
}
