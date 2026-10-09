import assert from "node:assert/strict";
import test from "node:test";
import i18next from "i18next";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../components/providers/ThemeProvider.js";
import en from "../i18n/en.json";
import zh from "../i18n/zh.json";
import type { AdminDashboardStats } from "../types/index.js";

async function loadCards() {
	const storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
	Object.defineProperty(globalThis, "localStorage", {
		configurable: true,
		value: { getItem: () => "en" },
	});
	try {
		return await import("../components/admin/AdminStatsCards.js");
	} finally {
		if (storage) Object.defineProperty(globalThis, "localStorage", storage);
		else Reflect.deleteProperty(globalThis, "localStorage");
	}
}
const { AdminStatsCards } = await loadCards();

async function renderCards(stats: AdminDashboardStats | null, loading: boolean, language = "en") {
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
			createElement(
				MemoryRouter,
				{},
				createElement(ThemeProvider, null, createElement(AdminStatsCards, { stats, loading })),
			),
		),
	);
}

test("loading and failed statistics retain all seven detail links without reporting zeros", async () => {
	for (const loading of [true, false]) {
		const html = await renderCards(null, loading);
		assert.equal(html.match(/href="\/admin\//g)?.length, 7);
		assert.match(html, /--/);
		assert.doesNotMatch(html, />0</);
		assert.ok(html.includes(loading ? "Loading statistics..." : "Statistics unavailable"));
	}
});

test("empty data shows real zero counts, status breakdown and the current paid snapshot in both languages", async () => {
	const point = { date: "2026-10-08T16:00:00Z", count: 0 };
	const outcomes = { success: 0, failed: 0, limited: 0, unknown: 0 };
	const stats: AdminDashboardStats = {
		start: point.date,
		end: "2026-10-09T04:15:00Z",
		generated_at: "2026-10-09T04:15:00Z",
		timezone: "Asia/Singapore",
		bucket: "day",
		metrics: {
			users: { total: 0, points: [point] },
			tokens: { total: 0, points: [point] },
			ips: { total: 0, points: [point] },
			messages: { total: 0, points: [point] },
			searches: { total: 0, points: [{ ...point, ...outcomes }], outcomes },
			fetches: { total: 0, points: [{ ...point, ...outcomes }], outcomes },
		},
		subscriptions: { total: 3, pro: 2, enterprise: 1 },
	};
	for (const [language, empty, snapshot] of [
		["en", "No new records in this period", "Current total"],
		["zh", "所选期间暂无新记录", "当前总数"],
	]) {
		const html = await renderCards(stats, false, language);
		assert.equal(html.match(/href="\/admin\//g)?.length, 7);
		assert.equal(html.split(empty).length - 1, 6);
		assert.ok(html.includes(snapshot));
		assert.match(html, />3</);
		assert.doesNotMatch(html, /--/);
		assert.ok(html.includes(language === "zh" ? "限流" : "Rate limited"));
		assert.ok(!html.includes(language === "zh" ? "状态未知" : "Unknown status"));
	}
});
