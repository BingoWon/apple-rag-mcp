/**
 * Modern subscription management utilities
 * Replaces legacy tier-based system with user_subscriptions table
 */

import { OAUTH_SUBSCRIPTION_QUOTAS, TIER_PERMISSIONS } from "../types/permissions";

export type PlanType = "hobby" | "pro" | "enterprise";
export type SubscriptionStatus = "active" | "inactive" | "canceled" | "past_due";

/**
 * Get user's current subscription plan type
 * @param userId - User ID
 * @param db - D1 Database instance
 * @returns Plan type (hobby, pro, enterprise)
 */
export async function getUserPlanType(userId: string, db: D1Database): Promise<PlanType> {
	const result = await db
		.prepare(
			"SELECT plan_type, status, payment_type, current_period_end FROM user_subscriptions WHERE user_id = ?",
		)
		.bind(userId)
		.first();

	return effectivePlanType(result);
}

export function effectivePlanType(
	result: Record<string, unknown> | null,
	now = Date.now(),
): PlanType {
	if (result?.status !== "active") return "hobby";
	if (
		result.payment_type === "one_time" &&
		result.current_period_end &&
		Date.parse(String(result.current_period_end)) < now
	)
		return "hobby";
	return (result.plan_type as PlanType) || "hobby";
}

/**
 * Get permissions for a plan type
 * @param planType - Plan type
 * @returns Permissions object
 */
export function getPlanPermissions(planType: PlanType) {
	return TIER_PERMISSIONS[planType] || TIER_PERMISSIONS.hobby;
}

/**
 * Get quota limits for a plan type
 * @param planType - Plan type
 * @returns Quota limits object
 */
export function getPlanQuotas(planType: PlanType) {
	return OAUTH_SUBSCRIPTION_QUOTAS[planType] || OAUTH_SUBSCRIPTION_QUOTAS.hobby;
}
