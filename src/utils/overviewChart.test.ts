import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
	buildOverviewChartOptions,
	CallsSparkline,
	formatActivityBuckets,
	overviewPalette,
} from "@/components/dashboard/OverviewChart";
import en from "@/i18n/en.json";
import zh from "@/i18n/zh.json";
import type { ToolActivity } from "../../shared/tool-activity";

function makeDailyActivity(days: number): ToolActivity {
	const startMs = Date.parse("2026-11-18T16:00:00.000Z"); // 2026-11-19 00:00 UTC+8
	const points = Array.from({ length: days }, (_, i) => ({
		date: new Date(startMs + i * 86_400_000).toISOString(),
		search: i === 0 ? 3 : i === 1 ? 7 : 0,
		browse: i === 0 ? 21 : 0,
		fetch: i === 0 ? 15 : 0,
	}));
	return {
		start: points[0].date,
		end: points[points.length - 1].date,
		bucket: "day",
		total: 46,
		by_tool: { search: 10, browse: 21, fetch: 15 },
		points,
	};
}

test("OverviewChart uses stacked column bars with exact discrete bucket categories for 7d", () => {
	const data = makeDailyActivity(7);
	const buckets = formatActivityBuckets(data.points, "day", "en");

	assert.equal(buckets.length, 7);
	assert.deepEqual(
		buckets.map((b) => b.axisLabel),
		["Nov 19", "Nov 20", "Nov 21", "Nov 22", "Nov 23", "Nov 24", "Nov 25"],
	);

	const options = buildOverviewChartOptions({
		data,
		visible: ["search", "browse", "fetch"],
		colors: overviewPalette(true),
		dark: true,
		locale: "en",
	});

	assert.equal(options.chart?.type, "bar");
	assert.equal(options.chart?.stacked, true);
	assert.equal(options.xaxis?.type, "category");
	assert.equal(options.xaxis?.categories?.length, 7);
	assert.equal(options.plotOptions?.bar?.borderRadiusApplication, "end");
	assert.equal(options.plotOptions?.bar?.borderRadiusWhenStacked, "last");
	assert.equal(options.grid?.xaxis?.lines?.show, false);
});

test("OverviewChart thins 24h and 30d labels while keeping first, last, and full tooltips", () => {
	const startMs = Date.parse("2026-11-24T04:00:00.000Z");
	const hourlyPoints = Array.from({ length: 24 }, (_, i) => ({
		date: new Date(startMs + i * 3_600_000).toISOString(),
		search: i === 0 ? 2 : 0,
		browse: 0,
		fetch: 0,
	}));
	const hourlyBuckets = formatActivityBuckets(hourlyPoints, "hour", "en");
	const visibleHourly = hourlyBuckets.filter((b) => b.axisLabel !== "");
	assert.ok(visibleHourly.length >= 6 && visibleHourly.length <= 8);
	assert.notEqual(hourlyBuckets[0].axisLabel, "");
	assert.notEqual(hourlyBuckets[hourlyBuckets.length - 1].axisLabel, "");
	assert.ok(hourlyBuckets.every((b) => b.tooltipLabel.length > 0));

	const daily30 = formatActivityBuckets(makeDailyActivity(30).points, "day", "en");
	const visibleDaily30 = daily30.filter((b) => b.axisLabel !== "");
	assert.ok(visibleDaily30.length >= 6 && visibleDaily30.length <= 8);
	assert.notEqual(daily30[0].axisLabel, "");
	assert.notEqual(daily30[daily30.length - 1].axisLabel, "");
});

test("OverviewChart bounds y-axis ticks for low single-digit totals", () => {
	const lowData: ToolActivity = {
		start: "2026-11-18T16:00:00.000Z",
		end: "2026-11-19T16:00:00.000Z",
		bucket: "day",
		total: 2,
		by_tool: { search: 2, browse: 0, fetch: 0 },
		points: [
			{ date: "2026-11-18T16:00:00.000Z", search: 2, browse: 0, fetch: 0 },
			{ date: "2026-11-19T16:00:00.000Z", search: 0, browse: 0, fetch: 0 },
		],
	};
	const options = buildOverviewChartOptions({
		data: lowData,
		visible: ["search"],
		colors: overviewPalette(false),
		dark: false,
		locale: "en",
	});
	const yaxis = Array.isArray(options.yaxis) ? options.yaxis[0] : options.yaxis;
	assert.equal(yaxis?.tickAmount, 2);
});

test("CallsSparkline renders a single non-occluding total trend curve", () => {
	const html = renderToStaticMarkup(createElement(CallsSparkline, { data: makeDailyActivity(7) }));
	assert.equal(html.split('fill="none"').length - 1, 1);
	assert.match(html, /stroke="var\(--brand\)"/);

	const emptyHtml = renderToStaticMarkup(
		createElement(CallsSparkline, {
			data: { ...makeDailyActivity(7), total: 0 },
		}),
	);
	assert.equal(emptyHtml, "");
});

test("StatsCards coverage label stays concise and single-line while preserving full tooltip detail", () => {
	assert.equal(en.dashboard.stats_embedded, "Indexed");
	assert.equal(zh.dashboard.stats_embedded, "已索引");
	assert.match(en.dashboard.stats_coverage_detail, /readable pages indexed/);
	assert.match(zh.dashboard.stats_coverage_detail, /可读页面/);
});
