/**
 * Modern subscription management utilities
 * Replaces legacy tier-based system with user_subscriptions table
 */

import { parseUTCDate } from "../../../shared/datetime";
import { OAUTH_SUBSCRIPTION_QUOTAS, TIER_PERMISSIONS } from "../types/permissions";

export type PlanType = "hobby" | "pro" | "enterprise";
export type SubscriptionStatus =
	| "active"
	| "inactive"
	| "canceled"
	| "past_due"
	| "trialing"
	| "incomplete"
	| "expired";
export type EntitlementSource = "free" | "stripe_subscription" | "one_time_pass" | "complimentary";

export interface ResolvedSubscriptionState {
	hasRecord: boolean;
	effectivePlan: PlanType;
	subscribedPlan: PlanType;
	effectiveStatus: SubscriptionStatus;
	entitlementSource: EntitlementSource;
	paymentType: "subscription" | "one_time";
	isExpiredOneTime: boolean;
	isStripeManaged: boolean;
	hasActiveStripeSubscription: boolean;
	canManageBilling: boolean;
	price: number;
	currency: string | null;
	billingInterval: string;
	currentPeriodStart?: string;
	currentPeriodEnd?: string;
	cancelAtPeriodEnd: boolean;
	stripeCustomerId?: string;
	stripeSubscriptionId?: string;
}

export function isTimestampExpired(value: unknown, now = Date.now()): boolean {
	if (!value) return false;
	const parsed = parseUTCDate(String(value));
	return parsed !== null && parsed.getTime() < now;
}

/**
 * Single source of truth resolving effective entitlements and billing metadata
 * from a raw `user_subscriptions` row without mutating stored data.
 */
export function resolveSubscriptionState(
	result: Record<string, unknown> | null | undefined,
	now = Date.now(),
): ResolvedSubscriptionState {
	if (!result) {
		return {
			hasRecord: false,
			effectivePlan: "hobby",
			subscribedPlan: "hobby",
			effectiveStatus: "active",
			entitlementSource: "free",
			paymentType: "subscription",
			isExpiredOneTime: false,
			isStripeManaged: false,
			hasActiveStripeSubscription: false,
			canManageBilling: false,
			price: 0,
			currency: null,
			billingInterval: "month",
			cancelAtPeriodEnd: false,
		};
	}

	const rawPlan = ((result.plan_type as PlanType) || "hobby") as PlanType;
	const rawStatus = ((result.status as SubscriptionStatus) || "active") as SubscriptionStatus;
	const paymentType: "subscription" | "one_time" =
		result.payment_type === "one_time" ? "one_time" : "subscription";
	const stripeCustomerId = result.stripe_customer_id
		? String(result.stripe_customer_id)
		: undefined;
	const stripeSubscriptionId = result.stripe_subscription_id
		? String(result.stripe_subscription_id)
		: undefined;
	const isStripeManaged = Boolean(stripeSubscriptionId);
	const currentPeriodStart = result.current_period_start
		? String(result.current_period_start)
		: undefined;
	const currentPeriodEnd = result.current_period_end
		? String(result.current_period_end)
		: undefined;
	const isExpiredOneTime = paymentType === "one_time" && isTimestampExpired(currentPeriodEnd, now);

	const effectivePlan = effectivePlanType(result, now);
	const effectiveStatus: SubscriptionStatus = isExpiredOneTime ? "expired" : rawStatus;
	const hasActiveStripeSubscription = paymentType === "subscription" && isStripeManaged;
	const canManageBilling = Boolean(stripeCustomerId && hasActiveStripeSubscription);

	const rawPrice = Number(result.price ?? 0);
	const rawCurrency = result.currency ? String(result.currency) : null;
	const rawInterval = result.billing_interval ? String(result.billing_interval) : "month";

	let entitlementSource: EntitlementSource = "free";
	if (effectivePlan !== "hobby") {
		if (paymentType === "one_time") {
			entitlementSource = "one_time_pass";
		} else if (isStripeManaged || rawPrice > 0) {
			entitlementSource = "stripe_subscription";
		} else {
			entitlementSource = "complimentary";
		}
	}

	// For Hobby rows (including ended subscriptions that retained stale dates/intervals),
	// suppress misleading billing price & historical periods.
	const isHobbyOnly = rawPlan === "hobby" && !hasActiveStripeSubscription && !isExpiredOneTime;

	return {
		hasRecord: true,
		effectivePlan,
		subscribedPlan: rawPlan,
		effectiveStatus,
		entitlementSource,
		paymentType,
		isExpiredOneTime,
		isStripeManaged,
		hasActiveStripeSubscription,
		canManageBilling,
		price: isHobbyOnly ? 0 : Number.isFinite(rawPrice) ? rawPrice : 0,
		currency: isHobbyOnly ? null : rawCurrency,
		billingInterval: isHobbyOnly ? "month" : rawInterval,
		currentPeriodStart: isHobbyOnly ? undefined : currentPeriodStart,
		currentPeriodEnd: isHobbyOnly ? undefined : currentPeriodEnd,
		cancelAtPeriodEnd: isHobbyOnly ? false : Boolean(result.cancel_at_period_end),
		stripeCustomerId: canManageBilling ? stripeCustomerId : undefined,
		stripeSubscriptionId,
	};
}

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
	result: Record<string, unknown> | null | undefined,
	now = Date.now(),
): PlanType {
	if (result?.status !== "active") return "hobby";
	if (result.payment_type === "one_time" && isTimestampExpired(result.current_period_end, now)) {
		return "hobby";
	}
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
