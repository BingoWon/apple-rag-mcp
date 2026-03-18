import type { PlanId, PricingOption } from "@/types/pricing";

export const PLAN_IDS = {
	HOBBY: "hobby",
	PRO: "pro",
	ENTERPRISE: "enterprise",
} as const satisfies Record<string, PlanId>;

export const CONTACT = {
	EMAIL: "bingow@outlook.com",
	SUPPORT_URL: "/support#contact",
} as const;

export const PRO_PRICING_OPTIONS: PricingOption[] = [
	{
		id: "weekly",
		price: 1,
		interval: "week",
		months: 0.25,
		subtitleKey: "per_week",
		popular: false,
	},
	{
		id: "monthly",
		price: 3,
		interval: "month",
		months: 1,
		subtitleKey: "per_month",
		popular: true,
		discount: "25% OFF",
	},
	{
		id: "semiannual",
		price: 15,
		interval: "month",
		months: 6,
		subtitleKey: "per_6months",
		popular: false,
		discount: "42% OFF",
	},
	{
		id: "annual",
		price: 20,
		interval: "year",
		months: 12,
		subtitleKey: "per_year",
		popular: false,
		discount: "62% OFF",
	},
];

export const PRO_ONETIME_OPTIONS: PricingOption[] = [
	{
		id: "onetime_weekly",
		price: 2,
		interval: "week",
		months: 0.25,
		subtitleKey: "onetime_duration_week",
		popular: false,
	},
	{
		id: "onetime_monthly",
		price: 5,
		interval: "month",
		months: 1,
		subtitleKey: "onetime_duration_month",
		popular: false,
	},
	{
		id: "onetime_semiannual",
		price: 20,
		interval: "month",
		months: 6,
		subtitleKey: "onetime_duration_6months",
		popular: false,
	},
	{
		id: "onetime_annual",
		price: 25,
		interval: "year",
		months: 12,
		subtitleKey: "onetime_duration_year",
		popular: false,
	},
];
