import { CONTACT, PLAN_IDS } from "@/constants/pricing";
import type { PlanId, PricingPlan, PricingTier } from "@/types/pricing";

const PRICING_PLANS: PricingPlan[] = [
	{
		id: PLAN_IDS.HOBBY,
		name: "Hobby",
		description: "Perfect for getting started and small projects.",
		price: "Free",
		quota: 50,
		popular: false,
		action: "register",
		gradientFrom: "from-gray-500",
		gradientTo: "to-yellow-500",
		features: [
			"50 queries per week",
			"5 requests per minute",
			"MCP fully supported",
			"Semantic Search for RAG",
			"Keyword search",
			"Hybrid search",
			"Community support",
		],
	},
	{
		id: PLAN_IDS.PRO,
		name: "Pro",
		description: "Best for professional developers and growing teams.",
		price: "$1 / week",
		quota: 50000,
		popular: true,
		action: "modal",
		gradientFrom: "from-green-500",
		gradientTo: "to-brand-tertiary",
		features: [
			"50,000 queries per week",
			"50 requests per minute",
			"MCP fully supported",
			"Semantic Search for RAG",
			"Keyword search",
			"Hybrid search",
			"Community support",
			"Multiple MCP tokens",
			"Faster response time",
			"Usage analytics",
		],
	},
	{
		id: PLAN_IDS.ENTERPRISE,
		name: "Enterprise",
		description: "Advanced features for large teams and organizations.",
		price: "Custom",
		quota: -1,
		popular: false,
		action: "contact",
		gradientFrom: "from-red-400",
		gradientTo: "to-brand-tertiary",
		features: [
			"Unlimited queries",
			"Unlimited requests per minute",
			"MCP fully supported",
			"Semantic Search for RAG",
			"Keyword search",
			"Hybrid search",
			"Community support",
			"Multiple MCP tokens",
			"Faster response time",
			"Usage analytics",
			"Dedicated infrastructure",
			"24/7 premium support",
		],
	},
];

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

export const getPricingPlans = (): PricingPlan[] => PRICING_PLANS;

export const getPricingTiers = (): PricingTier[] => PRICING_PLANS.map(createPricingTier);

export const getPlanById = (id: PlanId): PricingPlan | undefined => {
	const plan = PRICING_PLANS.find((plan) => plan.id === id);
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
