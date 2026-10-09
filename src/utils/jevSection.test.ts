import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import i18next from "i18next";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import en from "../i18n/en.json";
import zh from "../i18n/zh.json";

test("Jev section uses logo-prefixed branding and centered natural scrolling without a company row", async () => {
	const storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
	Object.defineProperty(globalThis, "localStorage", {
		configurable: true,
		value: { getItem: () => "en" },
	});
	try {
		const { JevSection } = await import("../components/sections/JevSection.js");
		for (const language of ["en", "zh"]) {
			const i18n = i18next.createInstance();
			await i18n.init({
				lng: language,
				resources: { en: { translation: en }, zh: { translation: zh } },
				interpolation: { escapeValue: false },
			});
			const html = renderToStaticMarkup(
				createElement(I18nextProvider, { i18n }, createElement(JevSection)),
			);

			assert.equal(html.split('class="jev-brand ').length - 1, 1);
			assert.ok(
				html.includes(
					language === "en" ? "API, platform, and version requirements" : "API、平台和版本要求",
				),
			);
			assert.ok(html.includes(language === "en" ? "Powered by " : "驱动"));
			assert.ok(!html.includes(language === "en" ? "Ranked by " : "文档重排序"));
			assert.ok(html.includes("jev-drawing"));
			assert.ok(html.includes('class="relative w-full"'));
			assert.ok(html.includes("min-h-[65svh]"));
			assert.ok(html.includes("items-center justify-center"));
			assert.ok(!html.includes("sticky"));
			assert.ok(!html.includes("180svh"));
			assert.ok(!html.includes("160svh"));
			assert.ok(!html.includes("400vh"));
			assert.ok(html.includes("text-3xl font-bold text-light sm:text-4xl"));
			assert.ok(html.includes("max-w-6xl text-lg leading-8 text-muted"));
			assert.ok(html.includes('viewBox="0 300 1440 430"'));
			assert.ok(html.includes('<feGaussianBlur in="SourceGraphic" stdDeviation="5"'));
			assert.ok(html.includes('href="https://typesafe.ai/"'));
			assert.ok(html.includes('src="/typesafe-logo.webp"'));
			assert.ok(existsSync(new URL("../../public/typesafe-logo.webp", import.meta.url)));
			const css = readFileSync(new URL("../styles/globals.css", import.meta.url), "utf8");
			for (const [token, color] of [
				["typesafe-lightest", "#F5B8E3"],
				["typesafe-light", "#ED82CE"],
				["typesafe", "#E650BB"],
				["typesafe-dark", "#DB1FA5"],
				["typesafe-deep", "#AA1880"],
			]) {
				assert.equal(html.split(`stroke="var(--color-${token})"`).length - 1, 2);
				assert.ok(css.includes(`--color-${token}: ${color};`));
			}
			assert.ok(!html.includes("Aceternity"));
			assert.ok(!html.includes("TypeSafe"));
			assert.ok(!html.includes(">typesafe.ai<"));
			assert.ok(!html.includes("Semantic and keyword"));
			assert.ok(!html.includes("语义与关键词"));
			assert.ok(!html.includes("leading-none"));
			assert.ok(!html.includes("text-typesafe"));
			assert.ok(html.includes("align-baseline whitespace-nowrap text-light"));
			assert.equal(html.split('stroke-dasharray="0 1"').length - 1, 10);
		}
	} finally {
		if (storage) Object.defineProperty(globalThis, "localStorage", storage);
		else Reflect.deleteProperty(globalThis, "localStorage");
	}
});
