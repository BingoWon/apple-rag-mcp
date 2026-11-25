import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { fittedCountAxis } from "@/components/charts/TrendChart";
import { PaginationControls } from "@/components/ui/PaginationControls";
import i18n from "@/i18n";
import { formatCurrency } from "@/lib/utils";
import type { CurrentUsage, Subscription } from "@/types";

registerHooks({
	load(url, context, nextLoad) {
		if (url.endsWith(".css")) {
			return { format: "module", shortCircuit: true, source: "" };
		}
		return nextLoad(url, context);
	},
});

const baseUsage: CurrentUsage = {
	current_usage: 120,
	limit: 50_000,
	remaining: 49_880,
	reset_at: "2026-11-29T00:00:00.000Z",
	usage_percentage: 0.24,
};

test("SubscriptionCard renders complimentary Pro without showing Free", async () => {
	const { SubscriptionCard } = await import("@/components/billing/SubscriptionCard");
	const subscription: Subscription = {
		id: "sub_comp",
		plan_id: "pro",
		subscribed_plan_id: "pro",
		plan_name: "Pro",
		status: "active",
		entitlement_source: "complimentary",
		has_active_stripe_subscription: false,
		can_manage_billing: false,
		price: 0,
		currency: null,
		billing_interval: "month",
		weekly_quota: 50_000,
		minute_quota: 50,
		payment_type: "subscription",
		cancel_at_period_end: false,
	};

	await i18n.changeLanguage("en");
	const enHtml = renderToStaticMarkup(
		createElement(
			I18nextProvider,
			{ i18n },
			createElement(SubscriptionCard, { subscription, usage: baseUsage }),
		),
	);
	assert.match(enHtml, /Pro Plan/);
	assert.match(enHtml, /Complimentary/);
	assert.match(enHtml, /50 tool calls per minute/);
	assert.doesNotMatch(enHtml, />Free</);

	await i18n.changeLanguage("zh");
	const zhHtml = renderToStaticMarkup(
		createElement(
			I18nextProvider,
			{ i18n },
			createElement(SubscriptionCard, { subscription, usage: baseUsage }),
		),
	);
	assert.match(zhHtml, /赠送权益/);
	assert.doesNotMatch(zhHtml, />免费</);
});

test("SubscriptionCard shows past_due payment recovery without Hobby/price contradiction", async () => {
	const { SubscriptionCard } = await import("@/components/billing/SubscriptionCard");
	const subscription: Subscription = {
		id: "sub_past_due",
		plan_id: "hobby",
		subscribed_plan_id: "pro",
		plan_name: "Hobby",
		status: "past_due",
		entitlement_source: "free",
		has_active_stripe_subscription: true,
		can_manage_billing: true,
		price: 3,
		currency: "USD",
		billing_interval: "month",
		weekly_quota: 50,
		minute_quota: 5,
		payment_type: "subscription",
		current_period_start: "2026-10-25T00:00:00.000Z",
		current_period_end: "2026-11-25T00:00:00.000Z",
		cancel_at_period_end: false,
	};

	await i18n.changeLanguage("en");
	const html = renderToStaticMarkup(
		createElement(
			I18nextProvider,
			{ i18n },
			createElement(SubscriptionCard, {
				subscription,
				usage: { ...baseUsage, limit: 50, remaining: 50, current_usage: 0, usage_percentage: 0 },
			}),
		),
	);
	assert.match(html, /Pro Plan/);
	assert.match(html, /Past Due/);
	assert.match(html, /Payment past due/);
	assert.match(html, /Update Payment Method/);
});

test("SubscriptionCard handles Enterprise unlimited quota and expired Pro Pass cleanly", async () => {
	const { SubscriptionCard } = await import("@/components/billing/SubscriptionCard");
	await i18n.changeLanguage("zh");
	const enterprise: Subscription = {
		id: "sub_ent",
		plan_id: "enterprise",
		subscribed_plan_id: "enterprise",
		plan_name: "Enterprise",
		status: "active",
		entitlement_source: "complimentary",
		has_active_stripe_subscription: false,
		can_manage_billing: false,
		price: 0,
		currency: null,
		billing_interval: "month",
		weekly_quota: -1,
		minute_quota: -1,
		payment_type: "subscription",
		cancel_at_period_end: false,
	};
	const entHtml = renderToStaticMarkup(
		createElement(
			I18nextProvider,
			{ i18n },
			createElement(SubscriptionCard, {
				subscription: enterprise,
				usage: { ...baseUsage, limit: -1, remaining: -1, usage_percentage: 0 },
			}),
		),
	);
	assert.match(entHtml, /定制/);
	assert.match(entHtml, /不限量/);
	assert.doesNotMatch(entHtml, /不限量\s*次调用/);

	await i18n.changeLanguage("en");
	const expiredPass: Subscription = {
		id: "sub_pass",
		plan_id: "hobby",
		subscribed_plan_id: "pro",
		plan_name: "Hobby",
		status: "expired",
		entitlement_source: "free",
		has_active_stripe_subscription: false,
		can_manage_billing: false,
		price: 3,
		currency: "USD",
		billing_interval: "month",
		weekly_quota: 50,
		minute_quota: 5,
		payment_type: "one_time",
		current_period_end: "2026-10-01T00:00:00.000Z",
		cancel_at_period_end: false,
	};
	const passHtml = renderToStaticMarkup(
		createElement(
			MemoryRouter,
			null,
			createElement(
				I18nextProvider,
				{ i18n },
				createElement(SubscriptionCard, { subscription: expiredPass, usage: null }),
			),
		),
	);
	assert.match(passHtml, /Pro Monthly Pass/);
	assert.match(passHtml, /Expired/);
	assert.doesNotMatch(passHtml, /Hobby.*Pass/);
});

test("formatCurrency, PaginationControls, and fittedCountAxis handle edge cases safely", async () => {
	assert.equal(formatCurrency(3, "USD", "en-US"), "$3.00");
	assert.equal(formatCurrency(Number.NaN, "USD", "en-US"), "—");
	assert.equal(formatCurrency(10, "INVALID_CODE", "en-US"), "10 INVALID_CODE");

	const axis = fittedCountAxis([100, 101]);
	assert.equal(Number.isInteger(axis.min), true);
	assert.equal(Number.isInteger(axis.max), true);
	assert.ok(axis.min <= 100 && axis.max >= 101);

	await i18n.changeLanguage("en");
	const paginationHtml = renderToStaticMarkup(
		createElement(
			I18nextProvider,
			{ i18n },
			createElement(PaginationControls, {
				currentPage: 5,
				totalPages: 4,
				pageSize: 10,
				total: 40,
				onPageChange: () => {},
			}),
		),
	);
	assert.match(paginationHtml, /Showing 31 to 40 of 40 entries/);
	assert.doesNotMatch(paginationHtml, /41 to 40/);
});
