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
		name: "Weekly",
		price: 1,
		interval: "week",
		months: 0.25,
		popular: false,
	},
	{
		id: "monthly",
		name: "Monthly",
		price: 3,
		interval: "month",
		months: 1,
		popular: true,
		discount: "25% OFF",
	},
	{
		id: "semiannual",
		name: "Semi-annual",
		price: 15,
		interval: "month",
		months: 6,
		popular: false,
		discount: "42% OFF",
	},
	{
		id: "annual",
		name: "Annual",
		price: 20,
		interval: "year",
		months: 12,
		popular: false,
		discount: "62% OFF",
	},
];

export const PRO_ONETIME_OPTIONS: PricingOption[] = [
	{
		id: "onetime_weekly",
		name: "Weekly",
		price: 2,
		interval: "week",
		months: 0.25,
		popular: false,
	},
	{
		id: "onetime_monthly",
		name: "Monthly",
		price: 5,
		interval: "month",
		months: 1,
		popular: true,
	},
	{
		id: "onetime_semiannual",
		name: "Semi-annual",
		price: 20,
		interval: "month",
		months: 6,
		popular: false,
	},
	{
		id: "onetime_annual",
		name: "Annual",
		price: 25,
		interval: "year",
		months: 12,
		popular: false,
	},
];

export const SUPPORTED_CLIENTS = [
	"Cursor",
	"Windsurf",
	"VS Code",
	"Claude Code",
	"Codex CLI",
	"Gemini CLI",
	"Augment Code",
	"Cline",
	"Roo Code",
	"Zed",
	"Trae",
	"Kiro",
	"Smithery",
	"BoltAI",
	"Copilot Coding Agent",
	"Lobe Chat",
	"Warp",
	"Opencode",
	"Perplexity Desktop",
	"LM Studio",
	"and more...",
] as const;
