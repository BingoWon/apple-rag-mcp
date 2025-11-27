/**
 * Rate Limiting Service with D1 timeout protection
 */

import type { AuthContext } from "../types/index.js";
import { withD1Timeout } from "../utils/d1-utils.js";
import { logger } from "../utils/logger.js";

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: string;
  planType: string;
  limitType: "weekly" | "minute";
  minuteLimit?: number;
  minuteRemaining?: number;
  minuteResetAt?: string;
}

interface PlanLimits {
  weeklyQueries: number;
  requestsPerMinute: number;
}

const PLAN_LIMITS: Record<string, PlanLimits> = {
  hobby: { weeklyQueries: 10, requestsPerMinute: 2 },
  pro: { weeklyQueries: 10000, requestsPerMinute: 20 },
  enterprise: { weeklyQueries: -1, requestsPerMinute: -1 },
};

export class RateLimitService {
  constructor(private d1: D1Database) {}

  async checkLimits(
    clientIP: string,
    authContext: AuthContext
  ): Promise<RateLimitResult> {
    const identifier = authContext.userId || `anon_${clientIP}`;
    const planType = authContext.isAuthenticated && authContext.userId
      ? await this.getPlanType(authContext.userId)
      : "hobby";

    const limits = PLAN_LIMITS[planType] || PLAN_LIMITS.hobby;

    const [weeklyUsage, minuteUsage] = await Promise.all([
      this.getUsageCount(identifier, "weekly"),
      this.getUsageCount(identifier, "minute"),
    ]);

    const weeklyAllowed = limits.weeklyQueries === -1 || weeklyUsage < limits.weeklyQueries;
    const minuteAllowed = limits.requestsPerMinute === -1 || minuteUsage < limits.requestsPerMinute;
    const allowed = weeklyAllowed && minuteAllowed;

    if (!allowed) {
      logger.info(
        `Rate limit: ${identifier} (${planType}) weekly=${weeklyUsage}/${limits.weeklyQueries} minute=${minuteUsage}/${limits.requestsPerMinute}`
      );
    }

    return {
      allowed,
      limit: limits.weeklyQueries,
      remaining: limits.weeklyQueries === -1 ? -1 : Math.max(0, limits.weeklyQueries - weeklyUsage),
      resetAt: this.getWeeklyResetTime(),
      planType,
      limitType: !minuteAllowed ? "minute" : "weekly",
      minuteLimit: limits.requestsPerMinute,
      minuteRemaining: limits.requestsPerMinute === -1 ? -1 : Math.max(0, limits.requestsPerMinute - minuteUsage),
      minuteResetAt: this.getMinuteResetTime(),
    };
  }

  private async getPlanType(userId: string): Promise<string> {
    return withD1Timeout(
      async () => {
        const result = await this.d1
          .prepare(
            `SELECT plan_type FROM user_subscriptions
             WHERE user_id = ? AND status = 'active' LIMIT 1`
          )
          .bind(userId)
          .first();
        return (result?.plan_type as string) || "hobby";
      },
      "hobby",
      "get_plan_type"
    );
  }

  private async getUsageCount(
    identifier: string,
    period: "weekly" | "minute"
  ): Promise<number> {
    const since = period === "weekly"
      ? this.getWeekStartTime().toISOString()
      : new Date(Date.now() - 60_000).toISOString();

    const operator = period === "weekly" ? ">=" : ">";

    return withD1Timeout(
      async () => {
        const result = await this.d1
          .prepare(
            `SELECT
              (SELECT COUNT(*) FROM search_logs WHERE user_id = ? AND created_at ${operator} ? AND status_code = 200) +
              (SELECT COUNT(*) FROM fetch_logs WHERE user_id = ? AND created_at ${operator} ? AND status_code = 200) as total`
          )
          .bind(identifier, since, identifier, since)
          .first();
        return (result?.total as number) || 0;
      },
      0,
      `get_${period}_usage`
    );
  }

  private getWeekStartTime(): Date {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private getWeeklyResetTime(): string {
    const now = new Date();
    const next = new Date(now);
    next.setDate(now.getDate() + (7 - now.getDay()));
    next.setHours(0, 0, 0, 0);
    return next.toISOString();
  }

  private getMinuteResetTime(): string {
    const next = new Date();
    next.setSeconds(0, 0);
    next.setMinutes(next.getMinutes() + 1);
    return next.toISOString();
  }
}
