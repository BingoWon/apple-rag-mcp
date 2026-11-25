import assert from "node:assert/strict";
import test from "node:test";
import { effectivePlanType, isTimestampExpired, resolveSubscriptionState } from "./subscription";

const NOW = Date.parse("2026-11-25T10:00:00.000Z");

test("isTimestampExpired parses both ISO-8601 and SQLite UTC timestamps", () => {
	assert.equal(isTimestampExpired("2026-11-25T09:59:59.000Z", NOW), true);
	assert.equal(isTimestampExpired("2026-11-25 09:59:59", NOW), true);
	assert.equal(isTimestampExpired("2026-11-25T10:00:01.000Z", NOW), false);
	assert.equal(isTimestampExpired("2026-11-25 10:00:01", NOW), false);
	assert.equal(isTimestampExpired(null, NOW), false);
});

test("resolveSubscriptionState handles missing and plain hobby records", () => {
	const missing = resolveSubscriptionState(null, NOW);
	assert.equal(missing.hasRecord, false);
	assert.equal(missing.effectivePlan, "hobby");
	assert.equal(missing.entitlementSource, "free");
	assert.equal(missing.canManageBilling, false);
	assert.equal(missing.price, 0);

	const hobby = resolveSubscriptionState(
		{
			plan_type: "hobby",
			status: "active",
			price: 0,
			currency: "USD",
			billing_interval: "month",
			payment_type: "subscription",
		},
		NOW,
	);
	assert.equal(hobby.effectivePlan, "hobby");
	assert.equal(hobby.entitlementSource, "free");
	assert.equal(hobby.currentPeriodStart, undefined);
	assert.equal(hobby.currentPeriodEnd, undefined);
	assert.equal(hobby.canManageBilling, false);
});

test("resolveSubscriptionState suppresses stale billing fields on ended Hobby rows", () => {
	const endedHobby = resolveSubscriptionState(
		{
			plan_type: "hobby",
			status: "active",
			price: 20,
			currency: "USD",
			billing_interval: "year",
			payment_type: "subscription",
			stripe_customer_id: "cus_historical",
			stripe_subscription_id: null,
			current_period_start: "2025-10-01T00:00:00Z",
			current_period_end: "2026-10-01T00:00:00Z",
			cancel_at_period_end: 1,
		},
		NOW,
	);

	assert.equal(endedHobby.effectivePlan, "hobby");
	assert.equal(endedHobby.entitlementSource, "free");
	assert.equal(endedHobby.price, 0);
	assert.equal(endedHobby.currency, null);
	assert.equal(endedHobby.billingInterval, "month");
	assert.equal(endedHobby.currentPeriodStart, undefined);
	assert.equal(endedHobby.currentPeriodEnd, undefined);
	assert.equal(endedHobby.cancelAtPeriodEnd, false);
	assert.equal(endedHobby.canManageBilling, false);
	assert.equal(endedHobby.stripeCustomerId, undefined);
});

test("resolveSubscriptionState identifies complimentary manual Pro grants cleanly", () => {
	const comped = resolveSubscriptionState(
		{
			plan_type: "pro",
			status: "active",
			price: 0,
			currency: null,
			billing_interval: "month",
			payment_type: "subscription",
			stripe_customer_id: null,
			stripe_subscription_id: null,
		},
		NOW,
	);

	assert.equal(comped.effectivePlan, "pro");
	assert.equal(comped.subscribedPlan, "pro");
	assert.equal(comped.effectiveStatus, "active");
	assert.equal(comped.entitlementSource, "complimentary");
	assert.equal(comped.isStripeManaged, false);
	assert.equal(comped.canManageBilling, false);
	assert.equal(comped.price, 0);
});

test("resolveSubscriptionState preserves subscribedPlan and billing portal access on past_due Pro", () => {
	const pastDue = resolveSubscriptionState(
		{
			plan_type: "pro",
			status: "past_due",
			price: 3,
			currency: "USD",
			billing_interval: "month",
			payment_type: "subscription",
			stripe_customer_id: "cus_123",
			stripe_subscription_id: "sub_123",
			current_period_start: "2026-10-25T00:00:00Z",
			current_period_end: "2026-11-25T00:00:00Z",
		},
		NOW,
	);

	assert.equal(pastDue.effectivePlan, "hobby");
	assert.equal(pastDue.subscribedPlan, "pro");
	assert.equal(pastDue.effectiveStatus, "past_due");
	assert.equal(pastDue.hasActiveStripeSubscription, true);
	assert.equal(pastDue.canManageBilling, true);
	assert.equal(pastDue.stripeCustomerId, "cus_123");
	assert.equal(pastDue.price, 3);
});

test("resolveSubscriptionState distinguishes active vs expired one-time passes", () => {
	const activePass = resolveSubscriptionState(
		{
			plan_type: "pro",
			status: "active",
			price: 3,
			currency: "USD",
			billing_interval: "month",
			payment_type: "one_time",
			current_period_start: "2026-11-01 00:00:00",
			current_period_end: "2026-12-01 00:00:00",
		},
		NOW,
	);
	assert.equal(activePass.effectivePlan, "pro");
	assert.equal(activePass.effectiveStatus, "active");
	assert.equal(activePass.entitlementSource, "one_time_pass");
	assert.equal(activePass.isExpiredOneTime, false);

	const expiredPass = resolveSubscriptionState(
		{
			plan_type: "pro",
			status: "active",
			price: 3,
			currency: "USD",
			billing_interval: "month",
			payment_type: "one_time",
			current_period_start: "2026-10-01 00:00:00",
			current_period_end: "2026-11-01 00:00:00",
		},
		NOW,
	);
	assert.equal(
		effectivePlanType(
			{
				plan_type: "pro",
				status: "active",
				payment_type: "one_time",
				current_period_end: "2026-11-01 00:00:00",
			},
			NOW,
		),
		"hobby",
	);
	assert.equal(expiredPass.effectivePlan, "hobby");
	assert.equal(expiredPass.subscribedPlan, "pro");
	assert.equal(expiredPass.effectiveStatus, "expired");
	assert.equal(expiredPass.isExpiredOneTime, true);
	assert.equal(expiredPass.canManageBilling, false);
});
