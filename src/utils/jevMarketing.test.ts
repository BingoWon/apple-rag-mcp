import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import i18next from "i18next";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import en from "../i18n/en.json";
import zh from "../i18n/zh.json";

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
		assert.ok(markdown.includes(file === "README.md" ? "not generated" : "不负责生成回答"));
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
		value: { getItem: (key: string) => (key === "sidebar-pinned" && expanded ? "true" : null) },
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
				assert.ok(html.includes('href="/#jev"'));
				assert.ok(html.includes('src="/typesafe-logo.webp"'));
				assert.equal(html.split('class="jev-brand ').length - 1, open ? 2 : 0);
				if (open) {
					assert.ok(html.includes(i18n.t("dashboard.jev_integration")));
					assert.ok(html.includes(i18n.t("dashboard.jev_learn_more")));
					assert.ok(html.includes("jev-brand-name font-bold"));
				} else {
					assert.ok(!html.includes(i18n.t("dashboard.jev_integration")));
					assert.ok(html.includes(`title="Jev: ${i18n.t("dashboard.jev_integration_label")}"`));
				}
			}
		}
	} finally {
		if (storage) Object.defineProperty(globalThis, "localStorage", storage);
		else Reflect.deleteProperty(globalThis, "localStorage");
	}
});
