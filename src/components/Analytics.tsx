import { useEffect } from "react";
import { useLocation, useSearchParams } from "react-router-dom";

const GA_TRACKING_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

// Google Analytics
export function GoogleAnalytics() {
	const { pathname } = useLocation();
	const [searchParams] = useSearchParams();

	useEffect(() => {
		if (!GA_TRACKING_ID) return;

		const script = document.createElement("script");
		script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`;
		script.async = true;
		document.head.appendChild(script);

		const inlineScript = document.createElement("script");
		inlineScript.innerHTML = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${GA_TRACKING_ID}', {
        page_location: window.location.href,
        page_title: document.title,
      });
    `;
		document.head.appendChild(inlineScript);

		return () => {
			document.head.removeChild(script);
			document.head.removeChild(inlineScript);
		};
	}, []);

	useEffect(() => {
		if (!GA_TRACKING_ID) return;

		const url = pathname + searchParams.toString();

		if (typeof window !== "undefined" && (window as { gtag?: (...args: unknown[]) => void }).gtag) {
			(window as unknown as { gtag: (...args: unknown[]) => void }).gtag("config", GA_TRACKING_ID, {
				page_location: url,
			});
		}
	}, [pathname, searchParams]);

	return null;
}

// Analytics utility functions
export const analytics = {
	// Track custom events
	event: (action: string, category: string, label?: string, value?: number) => {
		if (typeof window !== "undefined" && (window as { gtag?: (...args: unknown[]) => void }).gtag) {
			(window as unknown as { gtag: (...args: unknown[]) => void }).gtag("event", action, {
				event_category: category,
				event_label: label,
				value: value,
			});
		}
	},

	// Track page views
	pageview: (url: string) => {
		if (typeof window !== "undefined" && (window as { gtag?: (...args: unknown[]) => void }).gtag) {
			(window as unknown as { gtag: (...args: unknown[]) => void }).gtag("config", GA_TRACKING_ID, {
				page_location: url,
			});
		}
	},

	// Track user interactions
	trackClick: (elementName: string, location?: string) => {
		analytics.event("click", "engagement", `${elementName}${location ? ` - ${location}` : ""}`);
	},

	// Track form submissions
	trackFormSubmit: (formName: string, success: boolean = true) => {
		analytics.event("form_submit", "engagement", formName, success ? 1 : 0);
	},

	// Track API usage
	trackAPICall: (endpoint: string, success: boolean = true, responseTime?: number) => {
		analytics.event("api_call", "api", endpoint, success ? 1 : 0);
		if (responseTime) {
			analytics.event("api_response_time", "performance", endpoint, responseTime);
		}
	},

	// Track user registration
	trackSignUp: (method: string = "email") => {
		analytics.event("sign_up", "user", method);
	},

	// Track user login
	trackLogin: (method: string = "email") => {
		analytics.event("login", "user", method);
	},

	// Track subscription events
	trackSubscription: (action: "start" | "cancel" | "upgrade", plan: string) => {
		analytics.event(`subscription_${action}`, "subscription", plan);
	},

	// Track search queries
	trackSearch: (query: string, resultsCount?: number) => {
		analytics.event("search", "engagement", query, resultsCount);
	},

	// Track errors
	trackError: (error: string, location: string) => {
		analytics.event("error", "technical", `${location}: ${error}`);
	},
};

// Performance tracking
export function trackWebVitals(metric: { name: string; value: number; id: string }) {
	if (typeof window !== "undefined" && (window as { gtag?: (...args: unknown[]) => void }).gtag) {
		(window as unknown as { gtag: (...args: unknown[]) => void }).gtag("event", metric.name, {
			value: Math.round(metric.name === "CLS" ? metric.value * 1000 : metric.value),
			event_category: "Web Vitals",
			event_label: metric.id,
			non_interaction: true,
		});
	}
}

// Hotjar integration
export function Hotjar() {
	const HOTJAR_ID = import.meta.env.VITE_HOTJAR_ID;

	useEffect(() => {
		if (!HOTJAR_ID) return;
		const script = document.createElement("script");
		script.innerHTML = `
      (function(h,o,t,j,a,r){
        h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
        h._hjSettings={hjid:${HOTJAR_ID},hjsv:6};
        a=o.getElementsByTagName('head')[0];
        r=o.createElement('script');r.async=1;
        r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
        a.appendChild(r);
      })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
    `;
		document.head.appendChild(script);
		return () => {
			document.head.removeChild(script);
		};
	}, []);

	return null;
}

// Combined analytics component
export function Analytics() {
	return (
		<>
			<GoogleAnalytics />
			<Hotjar />
		</>
	);
}
