import assert from "node:assert/strict";
import test from "node:test";
import i18next from "i18next";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { OAUTH_SUBSCRIPTION_QUOTAS } from "../../worker/api/types/permissions.js";
import { supportedClients } from "../constants/mcpClients.js";
import en from "../i18n/en.json";
import zh from "../i18n/zh.json";

const rosters = {
	en: ["Codex", "Claude Code", "OpenCode", "Pi", "Antigravity", "Cursor", "VS Code", "Cline"],
	zh: [
		"Codex",
		"Claude Code",
		"OpenCode",
		"Antigravity",
		"Cursor",
		"DeepSeek Harness",
		"WorkBuddy",
		"TRAE",
	],
} as const;

test("quick start presents both agent connections and current trial limits with client guides", async () => {
	Object.defineProperty(globalThis, "localStorage", {
		configurable: true,
		value: { getItem: () => "en", setItem: () => {} },
	});
	const { QuickStartSection } = await import("../components/sections/QuickStartSection.js");
	for (const language of ["en", "zh"]) {
		const i18n = i18next.createInstance();
		await i18n.init({
			lng: language,
			resources: { en: { translation: en }, zh: { translation: zh } },
			interpolation: { escapeValue: false },
		});
		const html = renderToStaticMarkup(
			createElement(
				I18nextProvider,
				{ i18n },
				createElement(MemoryRouter, {}, createElement(QuickStartSection)),
			),
		);
		const list = html.slice(html.indexOf("<ul"), html.indexOf("</ul>"));
		const clients = supportedClients(language);
		assert.deepEqual(
			clients.map((c) => c.label),
			rosters[language as keyof typeof rosters],
		);
		assert.equal(list.match(/<li[ >]/g)?.length, clients.length);
		assert.equal(list.match(/<svg[ >]/g)?.length, clients.length);
		let lastIndex = -1;
		for (const client of clients) {
			assert.ok(list.includes(`href="${client.href}"`));
			const next = list.indexOf(`${client.label}</span>`);
			assert.ok(next > lastIndex, client.label);
			lastIndex = next;
		}
		assert.match(html, /id="quickstart"/);
		assert.match(html, /href="#pricing"/);
		assert.ok(html.includes(i18n.t("connect.copy_mcp")));
		assert.ok(html.includes(i18n.t("connect.copy_cli")));
		assert.equal(html.match(/<button /g)?.length, 2);
		assert.doesNotMatch(html, /aria-pressed|<fieldset/);
		assert.match(html, /<strong[^>]*>\$1 \/ (week|周)<\/strong>/);
		assert.doesNotMatch(html, /<pre|<code|<textarea|agent-setup\.txt/);
		assert.doesNotMatch(
			html,
			/Configure apple-rag-mcp|Connect this agent to Apple RAG|请为你当前使用的客户端配置/,
		);
		assert.ok(html.includes(i18n.t("quickstart.pro_weekly_calls")));
		assert.ok(html.includes(i18n.t("quickstart.pro_minute_calls")));
		assert.ok(html.includes(i18n.t("quickstart.title")));
		const anonymous = OAUTH_SUBSCRIPTION_QUOTAS.anonymous;
		assert.ok(
			html.includes(
				language === "en"
					? `${anonymous.week} calls per week, up to ${anonymous.minute} per minute`
					: `每周 ${anonymous.week} 次、每分钟最多 ${anonymous.minute} 次调用`,
			),
		);
		assert.doesNotMatch(html, /3x faster|3 倍|&lt;jev&gt;/);
	}
});
