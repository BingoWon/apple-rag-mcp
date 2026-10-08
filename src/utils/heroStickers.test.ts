import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import i18next from "i18next";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import en from "../i18n/en.json";
import zh from "../i18n/zh.json";

test("hero stickers use local images, accessible labels and official links in both languages", async () => {
	const storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
	Object.defineProperty(globalThis, "localStorage", {
		configurable: true,
		value: { getItem: () => "en" },
	});
	try {
		const { HeroContent } = await import("../components/sections/HeroContent.js");
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
				createElement(I18nextProvider, { i18n }, createElement(HeroContent)),
			);
			for (const [asset, label, className] of [
				["typesafe-ceo.webp", locale.hero.model_team, "hero-sticker-ceo"],
				["typesafe-logo.webp", locale.hero.model_logo, "hero-sticker-logo"],
			]) {
				assert.ok(existsSync(new URL(`../../public/${asset}`, import.meta.url)));
				assert.ok(html.includes(`src="/${asset}"`));
				assert.ok(html.includes(`alt="${label}"`));
				assert.ok(html.includes(`class="hero-sticker ${className}"`));
			}
			assert.equal(html.split('href="https://typesafe.ai/"').length - 1, 3);
			assert.ok(html.includes('href="https://github.com/BingoWon/apple-rag-mcp"'));
			assert.ok(
				html.indexOf('href="https://github.com/BingoWon/apple-rag-mcp"') <
					html.indexOf('class="hero-stickers"'),
			);
			assert.ok(html.includes(locale.hero.title_inject));
			assert.ok(html.includes('class="rag-name">RAG</span> + '));
			assert.ok(html.includes('class="rag-jev-pair inline-block whitespace-nowrap"'));
			assert.ok(html.includes('class="jev-brand '));
			assert.ok(!html.includes("TypeSafe"));
			assert.ok(!html.includes("&lt;jev&gt;"));
		}
	} finally {
		if (storage) Object.defineProperty(globalThis, "localStorage", storage);
		else Reflect.deleteProperty(globalThis, "localStorage");
	}
});
