import { StrictMode, Suspense, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import { BrowserRouter, useLocation } from "react-router-dom";
import { RouteErrorBoundary } from "@/components/ErrorBoundary";
import { Providers } from "@/components/providers/Providers";
import { captureSignupAttribution } from "@/lib/attribution";
import {
	hasDeploymentUpdate,
	lazyWithRecovery,
	recoverFromStaleDeployment,
} from "@/lib/deployment-recovery";
import { getSiteMetadata, siteStructuredJSON } from "../shared/site";
import { oauthReturnState } from "./lib/auth-return";
import { AppRouter } from "./router";
import "./i18n";
import "./styles/globals.css";

const AccountOverlays = lazyWithRecovery(() => import("@/components/AccountOverlays"));

function DeploymentSync() {
	const { pathname } = useLocation();
	const currentPathname = useRef(pathname);

	useEffect(() => {
		if (pathname === currentPathname.current) return;
		currentPathname.current = pathname;
		if (hasDeploymentUpdate()) {
			recoverFromStaleDeployment();
		}
	}, [pathname]);

	return null;
}

function SiteMetadata() {
	const { pathname, search } = useLocation();
	const { i18n } = useTranslation();
	useEffect(() => {
		captureSignupAttribution(search);
	}, [search]);
	useEffect(() => {
		const page = getSiteMetadata(pathname, i18n.resolvedLanguage);
		document.title = page.title;
		document.documentElement.lang = page.language;
		for (const selector of [
			'meta[name="description"]',
			'meta[property="og:description"]',
			'meta[name="twitter:description"]',
		])
			document.querySelector(selector)?.setAttribute("content", page.description);
		for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]'])
			document.querySelector(selector)?.setAttribute("content", page.title);
		document.querySelector('meta[name="robots"]')?.setAttribute("content", page.robots);
		document.querySelector('meta[property="og:locale"]')?.setAttribute("content", page.locale);
		for (const [selector, attribute] of [
			['link[rel="canonical"]', "href"],
			['meta[property="og:url"]', "content"],
		] as const) {
			let element = document.querySelector(selector);
			if (!page.canonical) {
				element?.remove();
				continue;
			}
			if (!element) {
				element = document.createElement(attribute === "href" ? "link" : "meta");
				element.setAttribute(
					attribute === "href" ? "rel" : "property",
					attribute === "href" ? "canonical" : "og:url",
				);
				document.head.append(element);
			}
			element.setAttribute(attribute, page.canonical);
		}
		let structured = document.querySelector('script[type="application/ld+json"]');
		if (!page.structuredData) structured?.remove();
		else {
			if (!structured) {
				structured = document.createElement("script");
				structured.setAttribute("type", "application/ld+json");
				document.head.append(structured);
			}
			structured.textContent = siteStructuredJSON(page.structuredData);
		}
	}, [pathname, i18n.resolvedLanguage]);
	return null;
}

function CustomerOverlays() {
	const location = useLocation();
	const { pathname } = location;
	if (
		oauthReturnState(location) ||
		pathname === "/admin" ||
		pathname.startsWith("/admin/") ||
		pathname.startsWith("/cli/") ||
		["/login", "/register", "/forgot-password", "/reset-password"].includes(
			pathname.replace(/\/$/, ""),
		)
	)
		return null;
	return (
		<Suspense fallback={null}>
			<AccountOverlays />
		</Suspense>
	);
}

const root = document.getElementById("root");

if (root) {
	createRoot(root).render(
		<StrictMode>
			<BrowserRouter>
				<RouteErrorBoundary scope="root">
					<Providers>
						<DeploymentSync />
						<SiteMetadata />
						<AppRouter />
					</Providers>
					<CustomerOverlays />
				</RouteErrorBoundary>
			</BrowserRouter>
		</StrictMode>,
	);
}
