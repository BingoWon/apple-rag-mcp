import assert from "node:assert/strict";
import test from "node:test";
import i18next from "i18next";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import en from "../i18n/en.json";
import zh from "../i18n/zh.json";

async function loadComponents() {
	const storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
	Object.defineProperty(globalThis, "localStorage", {
		configurable: true,
		value: { getItem: () => "en" },
	});
	try {
		const { MCPInstallButtons } = await import("../components/ui/MCPInstallButtons.js");
		const { MCPUsageGuide } = await import("../components/dashboard/MCPUsageGuide.js");
		const { useDashboardStore } = await import("../stores/dashboard.js");
		return { MCPInstallButtons, MCPUsageGuide, useDashboardStore };
	} finally {
		if (storage) Object.defineProperty(globalThis, "localStorage", storage);
		else Reflect.deleteProperty(globalThis, "localStorage");
	}
}

const { MCPInstallButtons, MCPUsageGuide, useDashboardStore } = await loadComponents();

async function renderWithTranslations(element: ReactElement, language: string) {
	const i18n = i18next.createInstance();
	await i18n.init({
		lng: language,
		resources: { en: { translation: en }, zh: { translation: zh } },
		interpolation: { escapeValue: false },
	});
	return renderToStaticMarkup(
		createElement(I18nextProvider, { i18n }, createElement(MemoryRouter, {}, element)),
	);
}

function renderButtons(language: string, token = "test-token", disabled = false) {
	return renderWithTranslations(
		createElement(MCPInstallButtons, {
			token,
			serverUrl: "https://mcp.apple-rag.com",
			disabled,
		}),
		language,
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
		assert.equal(html.match(/<img /g)?.length, 10);
		assert.match(
			html,
			/title="Codex, Claude Code, OpenCode, Pi, Antigravity, Cline, Augment Code"/,
		);
		const logos = [...html.matchAll(/<img\b[^>]*src="([^"]+)"/g)].map(([, src]) => src);
		assert.deepEqual(logos.slice(5, 7), ["/mcp-clients/cline.png", "/mcp-clients/augmentcode.png"]);
		assert.equal(html.match(/rounded-sm bg-white object-contain/g)?.length, 3);
		assert.doesNotMatch(html, /test-token/);
		assert.doesNotMatch(html, /Copy JSON|复制 JSON|Copy Configuration|复制配置/);
	}
});

test("shrinks only OpenCode and Pi logos and removes added padding from native install icons", async () => {
	const html = await renderButtons("en");
	const images = [...html.matchAll(/<img\b[^>]*>/g)].map(([image]) => image);
	assert.equal(images.length, 10);
	for (let index = 0; index < images.length; index++) {
		const image = images[index];
		const size = index === 2 || index === 3 || index >= 7 ? 16 : 20;
		assert.ok(image.includes(`width="${size}"`));
		assert.ok(image.includes(`height="${size}"`));
		if (index >= 7) {
			assert.match(image, /\brounded-sm\b/);
			assert.doesNotMatch(image, /\bp-\d/);
		}
	}
});

test("disables all actions while loading or when no token is selected", async () => {
	assert.equal((await renderButtons("en", "test-token", true)).match(/disabled=""/g)?.length, 4);
	assert.equal((await renderButtons("en", "")).match(/disabled=""/g)?.length, 4);
});

test("keeps the JSON code block visible outside the collapsed manual configuration", async () => {
	const state = useDashboardStore.getInitialState();
	const tokens = state.mcpTokens;
	state.mcpTokens = [
		{
			id: "test-token-id",
			name: "Test token",
			mcp_token: "test-token",
			created_at: "2026-10-03T00:00:00Z",
		},
	];
	try {
		for (const [language, label] of [
			["en", "JSON Configuration Example"],
			["zh", "JSON 配置示例"],
		]) {
			const html = await renderWithTranslations(createElement(MCPUsageGuide), language);
			const codeIndex = html.indexOf(label);
			assert.ok(codeIndex >= 0);
			assert.ok(html.indexOf("<details") > codeIndex);
			assert.match(html, /mcpServers/);
			assert.doesNotMatch(html, /<details[^>]*\sopen[=>\s]/);
		}
	} finally {
		state.mcpTokens = tokens;
	}
});
