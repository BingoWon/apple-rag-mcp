import { OAUTH_SUBSCRIPTION_QUOTAS } from "../api/types/permissions.js";
import { getUserPlanType } from "../api/utils/subscription.js";
import { withD1Timeout } from "../services/d1-utils.js";
import type { AuthContext, RateLimitResult } from "../services/types.js";

type Period = "weekly" | "minute";

export class RateLimitService {
	constructor(private d1: D1Database) {}

	private async plan(auth: AuthContext): Promise<string> {
		return auth.isAuthenticated && auth.userId
			? withD1Timeout(() => getUserPlanType(auth.userId!, this.d1), "get_plan_type")
			: "anonymous";
	}

	async getStatus(clientIP: string, auth: AuthContext): Promise<RateLimitResult> {
		const planType = await this.plan(auth);
		const quota = OAUTH_SUBSCRIPTION_QUOTAS[planType] || OAUTH_SUBSCRIPTION_QUOTAS.hobby;
		const counts = await withD1Timeout(
			() =>
				this.d1
					.prepare(
						"SELECT period, count FROM usage_counters WHERE identifier = ? AND ((period = 'weekly' AND window_start = ?) OR (period = 'minute' AND window_start = ?))",
					)
					.bind(
						auth.userId || `anon_${clientIP}`,
						this.getWeekStartTime().toISOString(),
						this.getMinuteStartTime().toISOString(),
					)
					.all<{ period: Period; count: number }>(),
			"read_quota",
		);
		if (!counts.success) throw new Error("Quota status could not be read.");
		const count = (period: Period) =>
			Number(counts.results?.find((row) => row.period === period)?.count ?? 0);
		const weekly = count("weekly"),
			minute = count("minute");
		const minuteLimited = quota.minute !== -1 && minute >= quota.minute;
		return this.result(
			(quota.week === -1 || weekly < quota.week) && !minuteLimited,
			minuteLimited ? "minute" : "weekly",
			planType,
			quota,
			weekly,
			minute,
		);
	}

	async checkLimits(
		clientIP: string,
		auth: AuthContext,
		id: string = crypto.randomUUID(),
	): Promise<RateLimitResult> {
		const identifier = auth.userId || `anon_${clientIP}`;
		const plan = await this.plan(auth);
		const quota = OAUTH_SUBSCRIPTION_QUOTAS[plan] || OAUTH_SUBSCRIPTION_QUOTAS.hobby;
		const weekly = this.getWeekStartTime().toISOString(),
			minute = this.getMinuteStartTime().toISOString();
		if (quota.week === -1 && quota.minute === -1)
			return this.result(true, "weekly", plan, quota, -1, -1);
		const reserve = this.d1
			.prepare(`INSERT INTO quota_reservations(id,identifier,weekly,minute)
 SELECT ?,?,?,? WHERE (?=-1 OR COALESCE((SELECT count FROM usage_counters WHERE identifier=? AND period='weekly' AND window_start=?),0)<?)
 AND (?=-1 OR COALESCE((SELECT count FROM usage_counters WHERE identifier=? AND period='minute' AND window_start=?),0)<?)
 ON CONFLICT(id) DO NOTHING RETURNING id`)
			.bind(
				id,
				identifier,
				quota.week === -1 ? null : weekly,
				quota.minute === -1 ? null : minute,
				quota.week,
				identifier,
				weekly,
				quota.week,
				quota.minute,
				identifier,
				minute,
				quota.minute,
			);
		const counts = this.d1
			.prepare(
				"SELECT period,count FROM usage_counters WHERE identifier=? AND ((period='weekly' AND window_start=?) OR (period='minute' AND window_start=?))",
			)
			.bind(identifier, weekly, minute);
		let outcome: D1Result<{ period: Period; count: number }>[];
		try {
			outcome = await this.d1.batch<{ period: Period; count: number }>([reserve, counts]);
		} catch (error) {
			// A lost acknowledgement may follow a commit. The tombstone also blocks a late reservation.
			await this.d1
				.prepare(
					"INSERT INTO quota_reservations(id,identifier,refunded) VALUES(?,?,1) ON CONFLICT(id) DO UPDATE SET refunded=1",
				)
				.bind(id, identifier)
				.run();
			throw error;
		}
		const allowed = outcome[0].results.length > 0;
		const used = (period: Period) =>
			Number(outcome[1].results.find((row) => row.period === period)?.count ?? 0);
		const weekUsed = used("weekly"),
			minuteUsed = used("minute");
		return {
			...this.result(
				allowed,
				!allowed && quota.minute !== -1 && minuteUsed >= quota.minute ? "minute" : "weekly",
				plan,
				quota,
				weekUsed,
				minuteUsed,
			),
			reservation: allowed ? id : undefined,
		};
	}
	async refund(result: RateLimitResult): Promise<void> {
		if (!result.reservation) return;
		const statement = this.d1
			.prepare("UPDATE quota_reservations SET refunded=1 WHERE id=? AND refunded=0")
			.bind(result.reservation);
		await statement.run().catch(() => statement.run());
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
