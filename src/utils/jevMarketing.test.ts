import assert from "node:assert/strict";
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
			}
		}
	} finally {
		if (storage) Object.defineProperty(globalThis, "localStorage", storage);
		else Reflect.deleteProperty(globalThis, "localStorage");
	}
});
