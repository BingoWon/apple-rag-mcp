import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import i18next from "i18next";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import serverJson from "../../server.json";
import { OAUTH_SUBSCRIPTION_QUOTAS } from "../../worker/api/types/permissions";
import { TOOLS } from "../../worker/mcp/constants";
import { SERVER_MANIFEST } from "../../worker/mcp/manifest";
import en from "../i18n/en.json";
import zh from "../i18n/zh.json";

test("page and sharing metadata consistently describe Jev integration", () => {
	const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
	const metadata = Object.fromEntries(
		[...html.matchAll(/<meta (?:name|property)="([^"]+)" content="([^"]+)"\s*\/>/g)].map(
			([, name, content]) => [name, content],
		),
	);
	const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
	assert.match(title ?? "", /Powered by Jev/);
	assert.equal(metadata["og:title"], title);
	assert.equal(metadata["twitter:title"], title);
	assert.match(metadata.description, /RAG retrieval and Jev relevance ranking/);
	assert.equal(metadata["og:description"], metadata.description);
	assert.equal(metadata["twitter:description"], metadata.description);
	const structured = JSON.parse(
		html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)?.[1] ?? "{}",
	);
	assert.equal(structured.description, metadata.description);
	assert.ok(structured.featureList.includes("Jev Relevance Ranking"));
	assert.equal(metadata["og:image"], metadata["twitter:image"]);
	assert.match(metadata["og:image:alt"], /Jev/);
	assert.equal(metadata["og:image:alt"], metadata["twitter:image:alt"]);
	const image = readFileSync(
		new URL(`../../public${new URL(metadata["og:image"]).pathname}`, import.meta.url),
	);
	assert.equal(image.subarray(1, 4).toString("ascii"), "PNG");
	assert.equal(image.readUInt32BE(16), 1200);
	assert.equal(image.readUInt32BE(20), 630);
});

test("discovery descriptions and agent documentation reflect the primary ranker and quotas", () => {
	assert.equal(serverJson.description, SERVER_MANIFEST.description);
	assert.match(SERVER_MANIFEST.description, /RAG retrieval and Jev relevance ranking/);
	assert.match(TOOLS.SEARCH.DESCRIPTION, /Jev relevance ranking/);
	assert.ok(!TOOLS.FETCH.DESCRIPTION.includes("Jev"));
	const guide = readFileSync(new URL("../../public/llms.txt", import.meta.url), "utf8");
	assert.ok(guide.includes("[Jev](https://typesafe.ai/)"));
	assert.ok(guide.includes("API, platform, and version"));
	assert.ok(guide.includes("shared by search and fetch"));
	assert.ok(!/unlimited|24\/7|dedicated infrastructure/i.test(guide));
	for (const [tier, label] of [
		["anonymous", "Anonymous"],
		["hobby", "Free Account"],
		["pro", "Pro"],
	] as const) {
		const quota = OAUTH_SUBSCRIPTION_QUOTAS[tier];
		const line = guide.split("\n").find((entry) => entry.startsWith(`**${label}**:`)) ?? "";
		assert.ok(line.includes(`${quota.week.toLocaleString("en-US")} tool calls per week`));
		assert.ok(line.includes(`${quota.minute} per minute`));
	}
});

test("retrieval marketing pairs RAG with Jev across the entire website copy", () => {
	for (const locale of [en, zh]) {
		for (const copy of [
			locale.hero.subtitle_desc,
			locale.features.subtitle,
			locale.features.ai_search_desc,
			locale.datasources.subtitle,
			locale.datasources.docs_desc,
			locale.datasources.videos_desc,
			locale.testimonials.subtitle,
			locale.pricing.subtitle,
			locale.plans.hybrid_search,
			locale.cta.subtitle,
			locale.footer.tagline,
			locale.success.feature_rag,
		]) {
			assert.ok(copy.includes("RAG"));
			assert.ok(copy.includes("<jev>Jev</jev>"));
		}
		assert.ok(!/Semantic|keyword|语义|关键词/.test(locale.jev.description));
	}
});

test("retrieval sections and footer render model logos in both languages", async () => {
	const storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
	Object.defineProperty(globalThis, "localStorage", {
		configurable: true,
		value: { getItem: () => "en" },
	});
	try {
		const { FeaturesSection } = await import("../components/sections/FeaturesSection.js");
		const { DataSourcesShowcase } = await import("../components/sections/DataSourcesSection.js");
		const { TestimonialsSection } = await import("../components/sections/TestimonialsSection.js");
		const { CTASection } = await import("../components/sections/CTASection.js");
		const { Footer } = await import("../components/layout/Footer.js");
		const { default: SuccessPage } = await import("../pages/SuccessPage.js");
		for (const language of ["en", "zh"]) {
			const i18n = i18next.createInstance();
			await i18n.init({
				lng: language,
				resources: { en: { translation: en }, zh: { translation: zh } },
				interpolation: { escapeValue: false },
			});
			for (const [Component, count] of [
				[FeaturesSection, 2],
				[DataSourcesShowcase, 3],
				[TestimonialsSection, 1],
				[CTASection, 1],
				[Footer, 1],
				[SuccessPage, 1],
			] as const) {
				const html = renderToStaticMarkup(
					createElement(
						I18nextProvider,
						{ i18n },
						createElement(MemoryRouter, {}, createElement(Component)),
					),
				);
				assert.equal(html.split('class="jev-brand ').length - 1, count);
				assert.ok(html.includes("RAG"));
				assert.ok(!html.includes("&lt;jev&gt;"));
				assert.ok(!html.includes("text-typesafe leading-none"));
				assert.ok(html.includes("jev-brand-name font-bold"));
				if (Component === CTASection) {
					assert.ok(!html.includes("max-w-2xl"));
					assert.ok(!html.includes("max-w-5xl"));
				}
			}
		}
	} finally {
		if (storage) Object.defineProperty(globalThis, "localStorage", storage);
		else Reflect.deleteProperty(globalThis, "localStorage");
	}
});

test("both READMEs introduce Jev scoring with a local logo and official link", () => {
	for (const file of ["README.md", "README.zh-CN.md"]) {
		const markdown = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
		assert.ok(markdown.includes("[Jev](https://typesafe.ai/)"));
		assert.ok(markdown.includes('src="./public/typesafe-logo.webp"'));
		assert.ok(markdown.includes("API"));
		assert.ok(markdown.includes(file === "README.md" ? "relevance scores" : "相关性评分"));
		assert.ok(markdown.includes(file === "README.md" ? "Powered by " : "### 由 "));
	}
});

test("Jev keeps one crisp lower-right shadow", () => {
	const css = readFileSync(new URL("../styles/globals.css", import.meta.url), "utf8");
	const rule = css.match(/\.jev-brand-name\s*\{([^}]+)\}/)?.[1] ?? "";
	assert.match(rule, /text-shadow:\s+[\d.]+em\s+[\d.]+em\s+0\s+var\(--color-typesafe\);/);
});

test("sidebar promotion sits below logout and collapses to its logo in both languages", async () => {
	const storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
	let expanded = false;
	Object.defineProperty(globalThis, "localStorage", {
		configurable: true,
		value: { getItem: (key: string) => (key === "sidebar-pinned" ? String(expanded) : null) },
	});
	try {
		const { AppleSidebar } = await import("../components/layout/AppleSidebar.js");
		const { ThemeProvider } = await import("../components/providers/ThemeProvider.js");
		for (const language of ["en", "zh"]) {
			const i18n = i18next.createInstance();
			await i18n.init({
				lng: language,
				resources: { en: { translation: en }, zh: { translation: zh } },
				interpolation: { escapeValue: false },
			});
			for (const open of [false, true]) {
				expanded = open;
				const html = renderToStaticMarkup(
					createElement(
						I18nextProvider,
						{ i18n },
						createElement(
							MemoryRouter,
							{ initialEntries: ["/overview/"] },
							createElement(
								ThemeProvider,
								null,
								createElement(
									AppleSidebar,
									null,
									createElement("div", { id: "dashboard-body-fixture" }),
								),
							),
						),
					),
				);
				const promotion = html.indexOf('class="sidebar-jev ');
				const logout = html.indexOf(i18n.t("common.logout"));
				const panel = html.indexOf("rounded-tl-2xl");
				assert.ok(logout >= 0 && promotion > logout && panel > promotion);
				assert.ok(!html.includes("dashboard-integration"));
				assert.ok(!html.includes("fixed h-full w-[80%]"));
				assert.ok(!html.includes('href="/#jev"'));
				assert.ok(html.includes('src="/typesafe-logo.webp"'));
				assert.equal(html.split('class="jev-brand ').length - 1, 0);
				assert.equal(html.split('class="jev-brand-name font-bold').length - 1, open ? 1 : 0);
				if (open) {
					assert.ok(html.includes(i18n.t("dashboard.jev_integration")));
					assert.ok(html.includes(language === "en" ? "Powered by " : "驱动"));
					assert.ok(!i18n.t("dashboard.jev_heading").includes("RAG"));
					assert.ok(!i18n.t("dashboard.jev_integration").includes("RAG"));
					assert.ok(html.includes("border-t border-default/60"));
					assert.ok(!html.includes("border-l-typesafe"));
					assert.ok(!html.includes("bg-typesafe/10"));
					assert.ok(html.includes("jev-brand-name font-bold"));
				} else {
					assert.ok(!html.includes(i18n.t("dashboard.jev_integration")));
					assert.ok(html.includes(`title="${i18n.t("dashboard.jev_integration_label")}"`));
				}
			}
		}
	} finally {
		if (storage) Object.defineProperty(globalThis, "localStorage", storage);
		else Reflect.deleteProperty(globalThis, "localStorage");
	}
});
