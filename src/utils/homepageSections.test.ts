import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import i18next from "i18next";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import en from "../i18n/en.json";
import zh from "../i18n/zh.json";

test("homepage keeps its original sections and reserves the FAQ for the connection guide", () => {
	const home = readFileSync(new URL("../pages/HomePage.tsx", import.meta.url), "utf8");
	let previous = -1;
	for (const section of [
		"HeroSection",
		"JevSection",
		"FeaturesSection",
		"QuickStartSection",
		"DataSourcesShowcase",
		"TestimonialsSection",
		"PricingSection",
		"CTASection",
		"Footer",
	]) {
		const position = home.indexOf(`<${section} />`);
		assert(position > previous, `${section} must remain in its original position`);
		previous = position;
	}
	assert(!home.includes("AgentFAQ"));
	const connect = readFileSync(new URL("../pages/ConnectPage.tsx", import.meta.url), "utf8");
	assert(connect.includes("<AgentFAQ />"));
});

test("original testimonial carousel and masked typewriter CTA render in both languages", async () => {
	const storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
	Object.defineProperty(globalThis, "localStorage", {
		configurable: true,
		value: { getItem: () => "en" },
	});
	try {
		const { TestimonialsSection } = await import("../components/sections/TestimonialsSection.js");
		const { CTASection } = await import("../components/sections/CTASection.js");
		for (const language of ["en", "zh"]) {
			const i18n = i18next.createInstance();
			await i18n.init({
				lng: language,
				resources: { en: { translation: en }, zh: { translation: zh } },
				interpolation: { escapeValue: false },
			});
			const render = (component: typeof CTASection) =>
				renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(component)));
			const carousel = render(TestimonialsSection);
			assert.match(carousel, /id="testimonials"/);
			assert.equal((carousel.match(/<img /g) ?? []).length, 6); // Five original portraits and the Jev logo.
			assert(carousel.includes(`aria-label="${i18n.t("common.next")}"`));
			assert(carousel.includes(`aria-label="${i18n.t("common.previous")}"`));
			const cta = render(CTASection);
			assert(cta.includes("mask:linear-gradient"));
			assert(cta.includes("white-space:nowrap"));
			assert(cta.includes("Vibe Coding"));
			assert(cta.includes("arrow-button"));
			assert(cta.includes('href="/register"'));
			assert(cta.includes("MCP"));
			assert(cta.includes("CLI"));
			assert(!cta.includes("cta.ready"));
		}
	} finally {
		if (storage) Object.defineProperty(globalThis, "localStorage", storage);
		else Reflect.deleteProperty(globalThis, "localStorage");
	}
});
