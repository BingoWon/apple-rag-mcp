import assert from "node:assert/strict";
import test from "node:test";
import { motionValue } from "motion/react";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import en from "../i18n/en.json";
import zh from "../i18n/zh.json";

test("Jev effect renders both locales with the original SVG styling and a working official link", async () => {
	const storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
	Object.defineProperty(globalThis, "localStorage", {
		configurable: true,
		value: { getItem: () => "en" },
	});
	try {
		const { GoogleGeminiEffect } = await import("../components/ui/google-gemini-effect.js");
		for (const locale of [en, zh]) {
			const html = renderToStaticMarkup(
				createElement(GoogleGeminiEffect, {
					title: locale.jev.title,
					description: locale.jev.description,
					pathLengths: [0.2, 0.15, 0.1, 0.05, 0].map((value) => motionValue(value)),
				}),
			);

			assert.ok(
				html.includes(renderToStaticMarkup(createElement(Fragment, null, locale.jev.title))),
			);
			assert.ok(
				html.includes(renderToStaticMarkup(createElement(Fragment, null, locale.jev.description))),
			);
			assert.ok(html.includes('class="sticky top-80"'));
			assert.ok(html.includes('viewBox="0 0 1440 890"'));
			assert.ok(html.includes('<feGaussianBlur in="SourceGraphic" stdDeviation="5"'));
			assert.ok(html.includes('href="https://typesafe.ai/"'));
			for (const color of ["#FFB7C5", "#FFDDB7", "#B1C5FF", "#4FABFF", "#076EFF"]) {
				assert.equal(html.split(`stroke="${color}"`).length - 1, 2);
			}
			assert.ok(!html.includes("Aceternity"));
		}
	} finally {
		if (storage) Object.defineProperty(globalThis, "localStorage", storage);
		else Reflect.deleteProperty(globalThis, "localStorage");
	}
});
