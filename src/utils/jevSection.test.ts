import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import i18next from "i18next";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import en from "../i18n/en.json";
import zh from "../i18n/zh.json";

test("Jev section preserves its curves with compact scrolling, standard typography and TypeSafe colors", async () => {
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

			assert.ok(
				html.includes(renderToStaticMarkup(createElement(Fragment, null, locale.jev.title))),
			);
			assert.ok(
				html.includes(renderToStaticMarkup(createElement(Fragment, null, locale.jev.description))),
			);
			assert.ok(html.includes('class="sticky top-24 sm:top-28"'));
			assert.ok(html.includes("h-[160svh]") && html.includes("sm:h-[180svh]"));
			assert.ok(!html.includes("400vh"));
			assert.ok(html.includes("text-3xl font-bold text-typesafe sm:text-4xl"));
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
		}
	} finally {
		if (storage) Object.defineProperty(globalThis, "localStorage", storage);
		else Reflect.deleteProperty(globalThis, "localStorage");
	}
});
