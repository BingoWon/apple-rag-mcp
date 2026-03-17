/**
 * Google Analytics 4 Event Tracking
 * Modern, type-safe analytics implementation for Apple RAG Website
 */

// GA4 Event Types
export interface GAEvent {
	action: string;
	category: string;
	label?: string;
	value?: number;
}

// Custom Events for Apple RAG MCP
export const AnalyticsEvents = {
	// User Authentication
	USER_REGISTER: {
		action: "sign_up",
		category: "engagement",
	},
	USER_LOGIN: {
		action: "login",
		category: "engagement",
	},
	USER_LOGOUT: {
		action: "logout",
		category: "engagement",
	},

	// MCP Core Business Events
	MCP_TOKEN_CREATE: {
		action: "create_mcp_token",
		category: "mcp_usage",
	},
	MCP_TOKEN_DELETE: {
		action: "delete_mcp_token",
		category: "mcp_usage",
	},

	// Subscription Events
	SUBSCRIPTION_START: {
		action: "begin_checkout",
		category: "ecommerce",
	},
	SUBSCRIPTION_SUCCESS: {
		action: "purchase",
		category: "ecommerce",
	},

	// Content Engagement
	PRICING_VIEW: {
		action: "view_pricing",
		category: "engagement",
	},
	GITHUB_CLICK: {
		action: "click_github",
		category: "external_link",
	},
	DOCUMENTATION_VIEW: {
		action: "view_documentation",
		category: "content",
	},

	// IP Authorization
	IP_AUTHORIZE: {
		action: "authorize_ip",
		category: "security",
	},
} as const;

// Type-safe event tracking function
export const trackEvent = (
	eventName: keyof typeof AnalyticsEvents,
	additionalParams?: Record<string, any>,
) => {
	if (typeof window === "undefined" || !window.gtag) return;

	const event = AnalyticsEvents[eventName];

	window.gtag("event", event.action, {
		event_category: event.category,
		...additionalParams,
	});
};

// Enhanced event tracking with custom parameters
export const trackCustomEvent = (action: string, parameters: Record<string, any> = {}) => {
	if (typeof window === "undefined" || !window.gtag) return;

	window.gtag("event", action, parameters);
};

// User identification for authenticated users
export const identifyUser = (userId: string, properties?: Record<string, any>) => {
	if (typeof window === "undefined" || !window.gtag) return;

	window.gtag("config", import.meta.env.VITE_GA_MEASUREMENT_ID!, {
		user_id: userId,
		custom_map: properties,
	});
};

// Page view tracking (handled automatically by Next.js integration)
export const trackPageView = (url: string, title?: string) => {
	if (typeof window === "undefined" || !window.gtag) return;

	window.gtag("config", import.meta.env.VITE_GA_MEASUREMENT_ID!, {
		page_title: title,
		page_location: url,
	});
};

// Conversion tracking
export const trackConversion = (conversionId: string, value?: number, currency = "USD") => {
	if (typeof window === "undefined" || !window.gtag) return;

	window.gtag("event", "conversion", {
		send_to: conversionId,
		value: value,
		currency: currency,
	});
};

// Global gtag type declaration
declare global {
	interface Window {
		gtag: (
			command: "config" | "event" | "js" | "consent",
			targetId: string | Date | "default" | "update",
			config?: Record<string, any>,
		) => void;
	}
}
