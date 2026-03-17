/**
 * Modern subscription management utilities
 * Replaces legacy tier-based system with user_subscriptions table
 */

import { OAUTH_SUBSCRIPTION_QUOTAS, TIER_PERMISSIONS } from "../types/permissions";

export type PlanType = "hobby" | "pro" | "enterprise";
export type SubscriptionStatus = "active" | "inactive" | "cancelled" | "past_due";

export interface UserSubscription {
	plan_type: PlanType;
	status: SubscriptionStatus;
	current_period_start?: string;
	current_period_end?: string;
	cancel_at_period_end: boolean;
}

/**
 * Get user's current subscription plan type
 * @param userId - User ID
 * @param db - D1 Database instance
 * @returns Plan type (hobby, pro, enterprise)
 */
export async function getUserPlanType(userId: string, db: D1Database): Promise<PlanType> {
	try {
		const result = await db
			.prepare("SELECT plan_type, status FROM user_subscriptions WHERE user_id = ?")
			.bind(userId)
			.first();

		// If no subscription record or inactive, default to hobby
		if (!result || result.status !== "active") {
			return "hobby";
		}

		return (result.plan_type as PlanType) || "hobby";
	} catch (error) {
		console.error("Error fetching user plan type:", error);
		return "hobby"; // Safe default
	}
}

/**
 * Get user's subscription details
 * @param userId - User ID
 * @param db - D1 Database instance
 * @returns Full subscription details
 */
export async function getUserSubscription(
	userId: string,
	db: D1Database,
): Promise<UserSubscription> {
	try {
		const result = await db
			.prepare(`
        SELECT plan_type, status, current_period_start, 
               current_period_end, cancel_at_period_end
        FROM user_subscriptions 
        WHERE user_id = ?
      `)
			.bind(userId)
			.first();

		if (!result) {
			return {
				plan_type: "hobby",
				status: "active",
				cancel_at_period_end: false,
			};
		}

		return {
			plan_type: (result.plan_type as PlanType) || "hobby",
			status: (result.status as SubscriptionStatus) || "active",
			current_period_start: result.current_period_start as string,
			current_period_end: result.current_period_end as string,
			cancel_at_period_end: Boolean(result.cancel_at_period_end),
		};
	} catch (error) {
		console.error("Error fetching user subscription:", error);
		return {
			plan_type: "hobby",
			status: "active",
			cancel_at_period_end: false,
		};
	}
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
