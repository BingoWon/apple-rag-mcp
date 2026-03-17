export type PlanId = "hobby" | "pro" | "enterprise";
export type BillingInterval = "week" | "month" | "year";
export type PlanAction = "register" | "modal" | "contact";
export type PricingOptionId = "weekly" | "monthly" | "semiannual" | "annual";

export interface PricingOption {
	id: PricingOptionId;
	name: string;
	price: number;
	interval: BillingInterval;
	months: number;
	popular?: boolean;
	discount?: string;
}

export interface PricingPlan {
	id: PlanId;
	name: string;
	description: string;
	price: string;
	quota: number;
	popular?: boolean;
	features: string[];
	action: PlanAction;
	gradientFrom: string;
	gradientTo: string;
}

export interface PricingTier {
	id: PlanId;
	name: string;
	description: string;
	displayPrice: string;
	features: string[];
	action: PlanAction;
	popular: boolean;
	gradientFrom: string;
	gradientTo: string;
	href: string;
}
