import assert from "node:assert/strict";
import test from "node:test";
import i18next from "i18next";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import { AgentFAQ } from "../components/sections/AgentFAQ.js";
import en from "../i18n/en.json";
import zh from "../i18n/zh.json";

test("connection FAQ covers both methods and recommends MCP in both languages", async () => {
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
			createElement(I18nextProvider, { i18n }, createElement(AgentFAQ)),
		);
		assert.equal((html.match(/<details /g) ?? []).length, 5);
		for (const topic of ["choice", "plan", "key", "control"] as const) {
			const question = locale.connect[`faq_${topic}_q`];
			const answer = locale.connect[`faq_${topic}_a`];
			assert(question.includes("MCP") && question.includes("CLI"));
			assert(html.includes(question));
			assert(answer.indexOf("MCP") < answer.indexOf("CLI"));
		}
		assert.match(locale.connect.faq_choice_a, /Start with MCP|优先使用 MCP/);
		assert.match(locale.connect.mcp_description, /Recommended|优先推荐/);
		assert(locale.connect.automation.includes("CLI"));
		assert(html.includes(locale.connect.faq_sources_q));
	}
});
