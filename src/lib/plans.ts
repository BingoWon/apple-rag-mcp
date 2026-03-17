import { CONTACT, PLAN_IDS } from "@/constants/pricing";
import i18n from "@/i18n";
import type { PlanId, PricingPlan, PricingTier } from "@/types/pricing";

function buildPricingPlans(): PricingPlan[] {
	return [
		{
			id: PLAN_IDS.HOBBY,
			name: i18n.t("plans.hobby"),
			description: i18n.t("plans.hobby_desc"),
			price: "Free",
			quota: 50,
			popular: false,
			action: "register",
			gradientFrom: "from-gray-500",
			gradientTo: "to-yellow-500",
			features: [
				i18n.t("plans.queries_per_week", { count: 50 }),
				i18n.t("plans.requests_per_minute", { count: 5 }),
				i18n.t("plans.mcp_supported"),
				i18n.t("plans.semantic_search"),
				i18n.t("plans.keyword_search"),
				i18n.t("plans.hybrid_search"),
				i18n.t("plans.community_support"),
			],
		},
		{
			id: PLAN_IDS.PRO,
			name: i18n.t("plans.pro"),
			description: i18n.t("plans.pro_desc"),
			price: "$1 / week",
			quota: 50000,
			popular: true,
			action: "modal",
			gradientFrom: "from-green-500",
			gradientTo: "to-brand-tertiary",
			features: [
				i18n.t("plans.queries_per_week", { count: "50,000" }),
				i18n.t("plans.requests_per_minute", { count: 50 }),
				i18n.t("plans.mcp_supported"),
				i18n.t("plans.semantic_search"),
				i18n.t("plans.keyword_search"),
				i18n.t("plans.hybrid_search"),
				i18n.t("plans.community_support"),
				i18n.t("plans.multiple_tokens"),
				i18n.t("plans.faster_response"),
				i18n.t("plans.usage_analytics"),
			],
		},
		{
			id: PLAN_IDS.ENTERPRISE,
			name: i18n.t("plans.enterprise"),
			description: i18n.t("plans.enterprise_desc"),
			price: "Custom",
			quota: -1,
			popular: false,
			action: "contact",
			gradientFrom: "from-red-400",
			gradientTo: "to-brand-tertiary",
			features: [
				i18n.t("plans.unlimited_queries"),
				i18n.t("plans.unlimited_rpm"),
				i18n.t("plans.mcp_supported"),
				i18n.t("plans.semantic_search"),
				i18n.t("plans.keyword_search"),
				i18n.t("plans.hybrid_search"),
				i18n.t("plans.community_support"),
				i18n.t("plans.multiple_tokens"),
				i18n.t("plans.faster_response"),
				i18n.t("plans.usage_analytics"),
				i18n.t("plans.dedicated_infra"),
				i18n.t("plans.premium_support"),
			],
		},
	];
}

export const getActionHref = (action: PricingPlan["action"]): string => {
	switch (action) {
		case "register":
			return "/register";
		case "modal":
			return "#";
		case "contact":
			return `mailto:${CONTACT.EMAIL}`;
		default:
			console.warn(`Unknown plan action: ${action}`);
			return "#";
	}
};

export const createPricingTier = (plan: PricingPlan): PricingTier => ({
	id: plan.id,
	name: plan.name,
	description: plan.description,
	displayPrice: plan.price,
	features: plan.features,
	action: plan.action,
	popular: plan.popular ?? false,
	gradientFrom: plan.gradientFrom,
	gradientTo: plan.gradientTo,
	href: getActionHref(plan.action),
});

export const getPricingPlans = (): PricingPlan[] => buildPricingPlans();

export const getPricingTiers = (): PricingTier[] => buildPricingPlans().map(createPricingTier);

export const getPlanById = (id: PlanId): PricingPlan | undefined => {
	const plan = buildPricingPlans().find((plan) => plan.id === id);
	if (!plan) {
		console.warn(`Pricing plan not found: ${id}`);
	}
	return plan;
};

export const getTierById = (id: PlanId): PricingTier | undefined => {
	const plan = getPlanById(id);
	return plan ? createPricingTier(plan) : undefined;
};

export const getStripePriceId = (planId: PlanId): string => {
	const priceIds: Record<PlanId, string> = {
		hobby: "",
		pro: "price_pro_weekly",
		enterprise: "",
	};

	return priceIds[planId] || "";
};
