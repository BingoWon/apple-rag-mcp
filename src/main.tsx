import { lazy, StrictMode, Suspense, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import { BrowserRouter, useLocation } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Providers } from "@/components/providers/Providers";
import { CookieConsent } from "@/components/ui/CookieConsent";
import { SITE_PAGES } from "../shared/site";
import { AppRouter } from "./router";
import "./i18n";
import "./styles/globals.css";

const FabButton = lazy(() =>
	import("@/components/ui/FabButton").then(({ FabButton }) => ({ default: FabButton })),
);
const UnreadReplyNotification = lazy(() =>
	import("@/components/UnreadReplyNotification").then(({ UnreadReplyNotification }) => ({
		default: UnreadReplyNotification,
	})),
);

function SiteMetadata() {
	const { pathname } = useLocation();
	const { t, i18n } = useTranslation();
	useEffect(() => {
		const path = pathname.replace(/\/$/, "") || "/";
		const page = SITE_PAGES[path === "/connect" ? "/connect" : "/"];
		const title = i18n.resolvedLanguage?.startsWith("zh")
			? path === "/connect"
				? "接入智能体 · MCP / CLI — Apple RAG"
				: "Apple RAG — 面向智能体的 Apple 开发知识服务"
			: page.title;
		const description = i18n.resolvedLanguage?.startsWith("zh")
			? t(path === "/connect" ? "connect.description" : "hero.description")
			: page.description;
		document.title = title;
		document.documentElement.lang = i18n.resolvedLanguage?.startsWith("zh") ? "zh" : "en";
		for (const selector of [
			'meta[name="description"]',
			'meta[property="og:description"]',
			'meta[name="twitter:description"]',
		])
			document.querySelector(selector)?.setAttribute("content", description);
		for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]'])
			document.querySelector(selector)?.setAttribute("content", title);
		const canonical = `https://apple-rag.com${path === "/connect" ? "/connect" : ""}`;
		document.querySelector('link[rel="canonical"]')?.setAttribute("href", canonical);
		document.querySelector('meta[property="og:url"]')?.setAttribute("content", canonical);
	}, [pathname, t, i18n.resolvedLanguage]);
	return null;
}

function CustomerOverlays() {
	const { pathname } = useLocation();
	if (
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
			<FabButton />
			<UnreadReplyNotification />
		</Suspense>
	);
}

const root = document.getElementById("root");

if (root) {
	createRoot(root).render(
		<StrictMode>
			<BrowserRouter>
				<ErrorBoundary>
					<Providers>
						<SiteMetadata />
						<AppRouter />
					</Providers>
					<CustomerOverlays />
					<CookieConsent />
				</ErrorBoundary>
			</BrowserRouter>
		</StrictMode>,
	);
}
