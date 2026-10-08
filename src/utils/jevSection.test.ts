import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import i18next from "i18next";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import en from "../i18n/en.json";
import zh from "../i18n/zh.json";

test("Jev section renders localized brand treatment, compact layout and the local TypeSafe logo", async () => {
	const storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
	Object.defineProperty(globalThis, "localStorage", {
		configurable: true,
		value: { getItem: () => "en" },
	});
	try {
		const { JevSection } = await import("../components/sections/JevSection.js");
		for (const [language, locale] of [
			["en", en],
			["zh", zh],
		] as const) {
			const i18n = i18next.createInstance();
			await i18n.init({
				lng: language,
				resources: { en: { translation: en }, zh: { translation: zh } },
				interpolation: { escapeValue: false },
			});
			const html = renderToStaticMarkup(
				createElement(I18nextProvider, { i18n }, createElement(JevSection)),
			);

			assert.ok(html.includes(language === "en" ? "Ranked by " : "文档重排序"));
			assert.ok(html.includes(">Jev</a>"));
			assert.ok(!html.includes("&lt;jev&gt;"));
			assert.ok(
				html.includes(renderToStaticMarkup(createElement(Fragment, null, locale.jev.description))),
			);
			assert.ok(html.includes('class="sticky top-24 sm:top-28"'));
			assert.ok(html.includes("h-[160svh]") && html.includes("sm:h-[180svh]"));
			assert.ok(html.includes("text-3xl font-bold text-light sm:text-4xl"));
			assert.ok(html.includes("max-w-6xl text-lg leading-8 text-muted"));
			assert.ok(!html.includes("400vh"));
			assert.ok(html.includes('viewBox="0 300 1440 430"'));
			assert.ok(html.includes('<feGaussianBlur in="SourceGraphic" stdDeviation="5"'));
			assert.ok(html.includes('href="https://typesafe.ai/"'));
			assert.ok(html.includes('src="/typesafe-logo.webp"'));
			assert.ok(html.includes('width="32" height="32"'));
			assert.ok(existsSync(new URL("../../public/typesafe-logo.webp", import.meta.url)));
			for (const color of ["#F7B7E5", "#F18ED6", "#E650BB", "#C73F9F", "#A52C85"]) {
				assert.equal(html.split(`stroke="${color}"`).length - 1, 2);
			}
			assert.ok(!html.includes("Aceternity"));
		}
	} finally {
		if (storage) Object.defineProperty(globalThis, "localStorage", storage);
		else Reflect.deleteProperty(globalThis, "localStorage");
	}
});
