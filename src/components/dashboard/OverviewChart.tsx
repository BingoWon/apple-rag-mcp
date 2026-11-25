import type { ApexOptions } from "apexcharts";
import { Suspense, useId } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/components/providers/ThemeProvider";
import { lazyWithRecovery } from "@/lib/deployment-recovery";
import { TOOL_KINDS, type ToolActivity, type ToolKind } from "../../../shared/tool-activity";

const ApexChart = lazyWithRecovery(() => import("react-apexcharts"));
const overviewColors = { search: "#128b84", fetch: "#5868d9", browse: "#bd4393" };
const nightColors = { search: "#39dfcf", fetch: "#99a7ff", browse: "#f09fdb" };
export const overviewPalette = (dark: boolean) => (dark ? nightColors : overviewColors);
type Palette = Record<ToolKind, string>;
type Point = [number, number];

function monotoneCurve(points: Point[]): string {
	return points.slice(1).reduce((line, [x, y], i) => {
		const [px, py] = points[i];
		const mid = (px + x) / 2;
		return `${line} C${mid},${py} ${mid},${y} ${x},${y}`;
	}, points[0].join(","));
}

export function shouldShowBucketTick(index: number, total: number): boolean {
	if (total <= 8) return true;
	if (index === 0 || index === total - 1) return true;
	const step = total <= 26 ? 4 : 5;
	return index % step === 0 && total - 1 - index >= Math.ceil(step * 0.6);
}

export function formatActivityBuckets(
	points: readonly ToolActivity["points"][number][],
	bucket: ToolActivity["bucket"],
	locale: string,
) {
	const axisFormat = new Intl.DateTimeFormat(locale, {
		timeZone: "Asia/Singapore",
		...(bucket === "hour"
			? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const }
			: { month: "short", day: "numeric" }),
	});
	const tooltipFormat = new Intl.DateTimeFormat(locale, {
		timeZone: "Asia/Singapore",
		month: "short",
		day: "numeric",
		...(bucket === "hour" ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const } : {}),
	});

	return points.map((point, index) => {
		const ms = Date.parse(point.date);
		return {
			key: point.date,
			axisLabel: shouldShowBucketTick(index, points.length) ? axisFormat.format(ms) : "",
			tooltipLabel: tooltipFormat.format(ms),
		};
	});
}

export function buildOverviewChartOptions({
	data,
	visible,
	colors,
	dark,
	locale,
}: {
	data: ToolActivity;
	visible: readonly ToolKind[];
	colors: Palette;
	dark: boolean;
	locale: string;
}): ApexOptions {
	const axis = dark ? "#94a3b8" : "#64748b";
	const buckets = formatActivityBuckets(data.points, data.bucket, locale);
	const maxBucketTotal = Math.max(0, ...data.points.map((p) => p.search + p.browse + p.fetch));
	const columnWidth = data.points.length <= 8 ? "42%" : data.points.length <= 26 ? "62%" : "68%";
	const borderRadius = data.points.length > 14 ? 2 : 4;
	const numberFormat = new Intl.NumberFormat(locale);

	return {
		chart: {
			type: "bar",
			stacked: true,
			background: "transparent",
			toolbar: { show: false },
			zoom: { enabled: false },
			animations: { enabled: false },
			foreColor: axis,
		},
		theme: { mode: dark ? "dark" : "light" },
		colors: visible.map((k) => colors[k]),
		plotOptions: {
			bar: {
				horizontal: false,
				columnWidth,
				borderRadius,
				borderRadiusApplication: "end",
				borderRadiusWhenStacked: "last",
			},
		},
		stroke: { width: 0 },
		fill: { opacity: 0.92 },
		dataLabels: { enabled: false },
		legend: { show: false },
		grid: {
			borderColor: dark ? "#334155" : "#cbd5e1",
			strokeDashArray: 3,
			xaxis: { lines: { show: false } },
			yaxis: { lines: { show: true } },
			padding: { left: 4, right: 8 },
		},
		xaxis: {
			type: "category",
			categories: buckets.map((b) => b.axisLabel),
			labels: {
				rotate: 0,
				trim: false,
				hideOverlappingLabels: false,
			},
			axisTicks: { show: false },
			axisBorder: { show: false },
		},
		yaxis: {
			min: 0,
			forceNiceScale: true,
			tickAmount: maxBucketTotal > 0 && maxBucketTotal < 4 ? maxBucketTotal : 4,
			labels: { formatter: (v) => numberFormat.format(Math.round(v)) },
		},
		tooltip: {
			shared: true,
			intersect: false,
			theme: dark ? "dark" : "light",
			x: {
				formatter: (value, opts) => {
					const idx = opts?.dataPointIndex;
					if (typeof idx === "number" && buckets[idx]) {
						return buckets[idx].tooltipLabel;
					}
					return String(value);
				},
			},
			y: {
				formatter: (v) => numberFormat.format(Math.round(v)),
			},
		},
		states: {
			hover: { filter: { type: "lighten" } },
			active: { filter: { type: "none" } },
		},
	};
}

export function CallsSparkline({ data }: { data: ToolActivity }) {
	const gradientId = useId();
	const { points } = data;
	if (!data.total || !points.length) return null;

	const samples = points.length === 1 ? [points[0], points[0]] : points;
	const totals = samples.map((p) => p.search + p.browse + p.fetch);
	const max = Math.max(1, ...totals);
	const baselineY = 50;
	const plotHeight = 42;
	const upper: Point[] = totals.map((total, i) => [
		(i * 240) / (samples.length - 1),
		baselineY - (total * plotHeight) / max,
	]);
	const edge = `M${monotoneCurve(upper)}`;
	const area = `${edge} L240,${baselineY} L0,${baselineY} Z`;

	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 240 54"
			preserveAspectRatio="none"
			width="100%"
			height="100%"
		>
			<defs>
				<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stopColor="var(--brand)" stopOpacity="0.28" />
					<stop offset="100%" stopColor="var(--brand)" stopOpacity="0.02" />
				</linearGradient>
			</defs>
			<path d={area} fill={`url(#${gradientId})`} />
			<path
				d={edge}
				fill="none"
				stroke="var(--brand)"
				strokeWidth="1.8"
				strokeLinecap="round"
				vectorEffect="non-scaling-stroke"
			/>
		</svg>
	);
}

export function OverviewChart({ data, colors }: { data: ToolActivity; colors: Palette }) {
	const { t, i18n } = useTranslation();
	const { resolvedTheme } = useTheme();
	const dark = resolvedTheme === "dark";
	const locale = i18n.resolvedLanguage ?? "en";
	const visible = TOOL_KINDS.filter((k) => data.by_tool[k] > 0);
	const options = buildOverviewChartOptions({ data, visible, colors, dark, locale });

	return (
		<div className="h-64 min-w-0 sm:h-80">
			<Suspense
				fallback={
					<div className="grid h-full place-items-center text-sm text-muted">
						{t("admin.stats_loading")}
					</div>
				}
			>
				<ApexChart
					type="bar"
					width="100%"
					height="100%"
					options={options}
					series={visible.map((k) => ({
						name: t(`activity.${k}`),
						data: data.points.map((p) => p[k]),
					}))}
				/>
			</Suspense>
		</div>
	);
}
