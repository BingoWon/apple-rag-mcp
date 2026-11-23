import assert from "node:assert/strict";
import test from "node:test";
import i18next from "i18next";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { fittedCountAxis } from "../components/charts/TrendChart.js";
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
const emptyModelCosts: AdminDashboardStats["model_costs"] = {
	first_recorded_at: null,
	exchange_rate: null,
	categories: {
		jev: { attempts: 0, unpriced_attempts: 0 },
		microsoft_decision: { attempts: 0, unpriced_attempts: 0 },
		embedding: { attempts: 0, unpriced_attempts: 0 },
		reranking: { attempts: 0, unpriced_attempts: 0 },
	},
	currencies: {},
};

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
				createElement(
					ThemeProvider,
					null,
					createElement(AdminStatsCards, {
						stats,
						loading,
						query: { period: "7d" },
						onChannelChange: () => {},
					}),
				),
			),
		),
	);
}

test("cumulative axis fits the change in range instead of starting at zero", () => {
	const axis = fittedCountAxis([10_000, 10_020, 10_010]);
	assert.ok(axis.min > 9_000);
	assert.ok(axis.min < 10_000);
	assert.ok(axis.max > 10_020);
	assert.equal(fittedCountAxis([0, 4]).min, 0);
});

test("loading and failed statistics retain tool detail links without reporting zeros", async () => {
	for (const loading of [true, false]) {
		const html = await renderCards(null, loading);
		for (const path of ["search-logs", "fetch-logs", "browse-logs"])
			assert.ok(html.includes(`/admin/${path}`));
		assert.match(html, /--/);
		assert.doesNotMatch(html, />0</);
		assert.ok(html.includes(loading ? "Loading statistics..." : "Statistics unavailable"));
	}
});

test("empty data shows real zero counts, status breakdown and the current paid snapshot in both languages", async () => {
	const point = { date: "2026-10-08T16:00:00Z", count: 0 };
	const outcomes = {
		success: 0,
		degraded: 0,
		no_content: 0,
		invalid: 0,
		failed: 0,
		limited: 0,
		cancelled: 0,
		unknown: 0,
	};
	const stats: AdminDashboardStats = {
		model_costs: emptyModelCosts,
		start: point.date,
		end: "2026-10-09T04:15:00Z",
		generated_at: "2026-10-09T04:15:00Z",
		timezone: "Asia/Singapore",
		bucket: "day",
		metrics: {
			users: { total: 0, points: [point] },
			new_users: {
				total: 0,
				points: [{ ...point, registered: 0, anonymous: 0 }],
				breakdown: { registered: 0, anonymous: 0 },
			},
			active_users: {
				total: 0,
				points: [{ ...point, registered: 0, anonymous: 0 }],
				breakdown: { registered: 0, anonymous: 0 },
			},
			cumulative_users: {
				total: 0,
				points: [{ ...point, registered: 0, anonymous: 0 }],
				breakdown: { registered: 0, anonymous: 0 },
			},
			tokens: { total: 0, points: [point] },
			ips: { total: 0, points: [point] },
			messages: { total: 0, points: [point] },
			searches: { total: 0, points: [{ ...point, ...outcomes }], outcomes },
			browses: { total: 0, points: [], outcomes },
			fetches: { total: 0, points: [{ ...point, ...outcomes }], outcomes },
		},
		billing: {
			history_complete: true,
			synced_at: null,
			new_subscribers: { total: 0, points: [] },
			renewing_subscribers: { total: 0, points: [] },
			receipts: {},
		},
		channels: {
			mcp: { total: 0, points: [] },
			cli: { total: 0, points: [] },
			unknown: { total: 0, points: [] },
		},
		subscriptions: { total: 3, pro: 2, enterprise: 1 },
	};
	for (const [language, empty, snapshot] of [
		["en", "No new records in this period", "Current total"],
		["zh", "所选期间暂无新记录", "当前总数"],
	]) {
		const html = await renderCards(stats, false, language);
		for (const path of ["search-logs", "fetch-logs", "browse-logs"])
			assert.ok(html.includes(`/admin/${path}`));
		assert.ok(html.includes(empty));
		assert.ok(html.includes(snapshot));
		assert.match(html, />3</);
		assert.doesNotMatch(html, /--/);
		assert.ok(html.includes(language === "zh" ? "限流" : "Rate limited"));
		assert.ok(!html.includes(language === "zh" ? "状态未知" : "Unknown status"));
		assert.ok(html.includes(language === "zh" ? "新用户" : "New users"));
		assert.ok(html.includes(language === "zh" ? "匿名用户" : "Anonymous"));
		assert.ok(html.includes(language === "zh" ? "实际使用用户" : "Active users"));
		assert.ok(html.includes(language === "zh" ? "累计用户" : "Cumulative users"));
	}
});

test("new-user table and active-user breakdown use real registered and anonymous counts", async () => {
	const point = { date: "2026-10-08T16:00:00Z", count: 0 };
	const stats: AdminDashboardStats = {
		model_costs: emptyModelCosts,
		start: point.date,
		end: "2026-10-09T04:15:00Z",
		generated_at: "2026-10-09T04:15:00Z",
		timezone: "Asia/Singapore",
		bucket: "day",
		metrics: {
			users: { total: 2, points: [point] },
			new_users: {
				total: 5,
				points: [{ ...point, count: 5, registered: 2, anonymous: 3 }],
				breakdown: { registered: 2, anonymous: 3 },
			},
			active_users: {
				total: 4,
				points: [{ ...point, count: 4, registered: 1, anonymous: 3 }],
				breakdown: { registered: 1, anonymous: 3 },
			},
			cumulative_users: {
				total: 9,
				points: [{ ...point, count: 9, registered: 4, anonymous: 5 }],
				breakdown: { registered: 4, anonymous: 5 },
			},
			tokens: { total: 0, points: [point] },
			ips: { total: 0, points: [point] },
			messages: { total: 0, points: [point] },
			searches: { total: 0, points: [point] },
			browses: { total: 0, points: [] },
			fetches: { total: 0, points: [point] },
		},
		billing: {
			history_complete: true,
			synced_at: null,
			new_subscribers: { total: 0, points: [] },
			renewing_subscribers: { total: 0, points: [] },
			receipts: {},
		},
		channels: {
			mcp: { total: 0, points: [] },
			cli: { total: 0, points: [] },
			unknown: { total: 0, points: [] },
		},
		subscriptions: { total: 0, pro: 0, enterprise: 0 },
	};
	const html = await renderCards(stats, false);
	assert.ok(html.includes("New users"));
	assert.ok(html.includes("User type"));
	assert.ok(html.includes("Registered"));
	assert.ok(html.includes("Anonymous"));
	assert.ok(html.includes("Active users"));
	assert.ok(html.includes("New signups plus first-seen anonymous identities"));
	assert.ok(html.includes("Cumulative users"));
	assert.ok(html.includes("accounts that still exist"));
	assert.match(html, />5</);
	assert.match(html, />4</);
	assert.match(html, />9</);
});
