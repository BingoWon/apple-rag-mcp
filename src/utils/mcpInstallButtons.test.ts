import assert from "node:assert/strict";
import test from "node:test";
import i18next from "i18next";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import en from "../i18n/en.json";
import zh from "../i18n/zh.json";

async function loadButtons() {
	const storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
	Object.defineProperty(globalThis, "localStorage", {
		configurable: true,
		value: { getItem: () => "en" },
	});
	try {
		return await import("../components/ui/MCPInstallButtons.js");
	} finally {
		if (storage) Object.defineProperty(globalThis, "localStorage", storage);
		else Reflect.deleteProperty(globalThis, "localStorage");
	}
}

const { MCPInstallButtons } = await loadButtons();

async function renderButtons(language: string, token = "test-token", disabled = false) {
	const i18n = i18next.createInstance();
	await i18n.init({
		lng: language,
		resources: { en: { translation: en }, zh: { translation: zh } },
		interpolation: { escapeValue: false },
	});
	return renderToStaticMarkup(
		createElement(
			I18nextProvider,
			{ i18n },
			createElement(MCPInstallButtons, {
				token,
				serverUrl: "https://mcp.apple-rag.com",
				disabled,
			}),
		),
	);
}

test("renders one copy-prompt button and three native install buttons in both languages", async () => {
	for (const [language, label] of [
		["en", "Copy Install Prompt"],
		["zh", "复制安装提示词"],
	]) {
		const html = await renderButtons(language);
		assert.ok(html.includes(label));
		assert.equal(html.match(/<button /g)?.length, 4);
		assert.equal(html.match(/<img /g)?.length, 7);
		assert.match(html, /title="Codex, Claude Code, OpenCode, Pi"/);
		assert.doesNotMatch(html, /test-token/);
		assert.doesNotMatch(html, /Copy JSON|复制 JSON|Copy Configuration|复制配置/);
	}
});

test("disables all actions while loading or when no token is selected", async () => {
	assert.equal((await renderButtons("en", "test-token", true)).match(/disabled=""/g)?.length, 4);
	assert.equal((await renderButtons("en", "")).match(/disabled=""/g)?.length, 4);
});
