import { OAUTH_SUBSCRIPTION_QUOTAS } from "../api/types/permissions.js";
import { getUserPlanType } from "../api/utils/subscription.js";
import type { AuthContext, RateLimitResult } from "../mcp-types/index.js";
import { withD1Timeout } from "../mcp-utils/d1-utils.js";
import { logger } from "../mcp-utils/logger.js";

type Period = "weekly" | "minute";

export class RateLimitService {
	constructor(private d1: D1Database) {}

	async checkLimits(clientIP: string, authContext: AuthContext): Promise<RateLimitResult> {
		const identifier = authContext.userId || `anon_${clientIP}`;
		const planType =
			authContext.isAuthenticated && authContext.userId
				? await withD1Timeout(() => getUserPlanType(authContext.userId!, this.d1), "get_plan_type")
				: "anonymous";
		const quota = OAUTH_SUBSCRIPTION_QUOTAS[planType] || OAUTH_SUBSCRIPTION_QUOTAS.hobby;
		const weeklyWindow = this.getWeekStartTime().toISOString();
		const minuteWindow = this.getMinuteStartTime().toISOString();
		const windows: Array<{ period: Period; windowStart: string }> = [];

		const weeklyCount = await this.consume(identifier, "weekly", weeklyWindow, quota.week);
		if (weeklyCount === null) {
			return this.result(false, "weekly", planType, quota, quota.week, 0);
		}
		if (quota.week !== -1) {
			windows.push({ period: "weekly", windowStart: weeklyWindow });
		}

		const minuteCount = await this.consume(identifier, "minute", minuteWindow, quota.minute);
		if (minuteCount === null) {
			await this.refundWindows(identifier, windows);
			const refundedWeeklyCount = weeklyCount === -1 ? -1 : weeklyCount - 1;
			return this.result(false, "minute", planType, quota, refundedWeeklyCount, quota.minute);
		}
		if (quota.minute !== -1) {
			windows.push({ period: "minute", windowStart: minuteWindow });
		}

		return {
			...this.result(true, "weekly", planType, quota, weeklyCount, minuteCount),
			reservation: windows.length > 0 ? { identifier, windows } : undefined,
		};
	}

	async refund(result: RateLimitResult): Promise<void> {
		if (!result.reservation) return;
		await this.refundWindows(result.reservation.identifier, result.reservation.windows);
	}

	private async consume(
		identifier: string,
		period: Period,
		windowStart: string,
		limit: number,
	): Promise<number | null> {
		if (limit === -1) return -1;

		const result = await withD1Timeout(
			() =>
				this.d1
					.prepare(
						`INSERT INTO usage_counters
						 (identifier, period, window_start, count, updated_at)
						 VALUES (?, ?, ?, 1, ?)
						 ON CONFLICT(identifier, period, window_start) DO UPDATE SET
						   count = usage_counters.count + 1,
						   updated_at = excluded.updated_at
						 WHERE usage_counters.count < ?
						 RETURNING count`,
					)
					.bind(identifier, period, windowStart, new Date().toISOString(), limit)
					.first<{ count: number }>(),
			`consume_${period}_quota`,
		);

		if (!result) {
			logger.info(`Rate limit reached: ${identifier} ${period}=${limit}`);
			return null;
		}

		return Number(result.count);
	}

	private async refundWindows(
		identifier: string,
		windows: Array<{ period: Period; windowStart: string }>,
	): Promise<void> {
		if (windows.length === 0) return;

		await withD1Timeout(
			() =>
				this.d1.batch(
					windows.map(({ period, windowStart }) =>
						this.d1
							.prepare(
								`UPDATE usage_counters
								 SET count = MAX(0, count - 1), updated_at = ?
								 WHERE identifier = ? AND period = ? AND window_start = ?`,
							)
							.bind(new Date().toISOString(), identifier, period, windowStart),
					),
				),
			"refund_quota",
		);
	}

	private result(
		allowed: boolean,
		limitType: Period,
		planType: string,
		quota: { week: number; minute: number },
		weeklyCount: number,
		minuteCount: number,
	): RateLimitResult {
		return {
			allowed,
			limit: quota.week,
			remaining: quota.week === -1 ? -1 : Math.max(0, quota.week - weeklyCount),
			resetAt: this.getWeeklyResetTime().toISOString(),
			planType,
			limitType,
			minuteLimit: quota.minute,
			minuteRemaining: quota.minute === -1 ? -1 : Math.max(0, quota.minute - minuteCount),
			minuteResetAt: this.getMinuteResetTime().toISOString(),
		};
	}

	private getWeekStartTime(): Date {
		const start = new Date();
		start.setUTCDate(start.getUTCDate() - start.getUTCDay());
		start.setUTCHours(0, 0, 0, 0);
		return start;
	}

	private getWeeklyResetTime(): Date {
		const reset = this.getWeekStartTime();
		reset.setUTCDate(reset.getUTCDate() + 7);
		return reset;
	}

	private getMinuteStartTime(): Date {
		const start = new Date();
		start.setUTCSeconds(0, 0);
		return start;
	}

	private getMinuteResetTime(): Date {
		const reset = this.getMinuteStartTime();
		reset.setUTCMinutes(reset.getUTCMinutes() + 1);
		return reset;
	}
}
