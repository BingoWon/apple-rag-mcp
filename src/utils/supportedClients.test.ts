import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import i18next from "i18next";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import { OAUTH_SUBSCRIPTION_QUOTAS } from "../../worker/api/types/permissions.js";
import { QuickStartSection } from "../components/sections/QuickStartSection.js";
import { SUPPORTED_CLIENTS } from "../constants/clients.js";
import { INSTALL_CLIENTS, PROMPT_CLIENTS } from "../constants/mcpClients.js";
import en from "../i18n/en.json";
import zh from "../i18n/zh.json";

test("supported clients follow the copy-button order and exclude VS Code Insiders", () => {
	assert.deepEqual(
		SUPPORTED_CLIENTS.map((client) => client.label),
		[
			"Codex",
			"Claude Code",
			"OpenCode",
			"Pi",
			"Antigravity",
			"Cursor",
			"VS Code",
			"Cline",
			"Augment Code",
		],
	);
	assert.deepEqual(
		SUPPORTED_CLIENTS.filter((client) =>
			PROMPT_CLIENTS.some((promptClient) => promptClient.label === client.label),
		),
		PROMPT_CLIENTS,
	);
	assert.deepEqual(
		SUPPORTED_CLIENTS.slice(-2).map((client) => client.label),
		["Cline", "Augment Code"],
	);
	assert.equal(INSTALL_CLIENTS.filter((client) => client.key === "vscode-insiders").length, 1);
	assert.equal(new Set(SUPPORTED_CLIENTS.map((client) => client.label)).size, 9);
	for (const client of SUPPORTED_CLIENTS) {
		assert.ok(existsSync(new URL(`../../public${client.logo}`, import.meta.url)), client.label);
		assert.equal(new URL(client.href).protocol, "https:");
	}
});

test("quick start renders each local logo and linked name in order in both languages", async () => {
	for (const language of ["en", "zh"]) {
		const i18n = i18next.createInstance();
		await i18n.init({
			lng: language,
			resources: { en: { translation: en }, zh: { translation: zh } },
			interpolation: { escapeValue: false },
		});
		const html = renderToStaticMarkup(
			createElement(I18nextProvider, { i18n }, createElement(QuickStartSection)),
		);
		const list = html.slice(html.indexOf("<ul"), html.indexOf("</ul>"));
		assert.equal(list.match(/<li>/g)?.length, 9);
		assert.equal(list.match(/<img /g)?.length, 9);
		let lastIndex = -1;
		for (const client of SUPPORTED_CLIENTS) {
			assert.ok(list.includes(`href="${client.href}"`));
			assert.ok(list.includes(`src="${client.logo}"`));
			const index = list.indexOf(`>${client.label}</span>`);
			assert.ok(index > lastIndex, client.label);
			lastIndex = index;
		}
		assert.doesNotMatch(html, /VS Code Insiders|vscode-insiders/);
		assert.equal(list.match(/loading="lazy"/g)?.length, 9);
		assert.equal(list.match(/decoding="async"/g)?.length, 9);
		assert.match(html, /mcp-config\.json/);
		assert.match(html, /mcpServers/);
		assert.match(html, /id="quickstart"/);
		assert.match(html, /href="#pricing"/);
		assert.ok(html.includes(i18n.t("quickstart.title")));
		const quota = OAUTH_SUBSCRIPTION_QUOTAS.pro;
		assert.ok(html.includes(quota.week.toLocaleString("en-US")));
		assert.ok(
			html.includes(
				language === "en" ? `${quota.minute} tool calls/minute` : `每分钟 ${quota.minute} 次调用`,
			),
		);
		assert.ok(html.includes(i18n.t("plans.price_pro")));
		const anonymous = OAUTH_SUBSCRIPTION_QUOTAS.anonymous;
		assert.ok(
			html.includes(
				language === "en"
					? `${anonymous.week} tool calls/week, ${anonymous.minute}/minute`
					: `每周 ${anonymous.week} 次、每分钟 ${anonymous.minute} 次调用`,
			),
		);
		assert.doesNotMatch(html, /3x faster|3 倍|&lt;jev&gt;/);
	}
});
