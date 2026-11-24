import type { ApexOptions } from "apexcharts";
import { memo, Suspense, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/components/providers/ThemeProvider";
import { lazyWithRecovery } from "@/lib/deployment-recovery";
import type { AdminMetricStats } from "@/types";
import { TOOL_OUTCOMES } from "../../../shared/tool-outcomes";

const ApexChart = lazyWithRecovery(() => import("react-apexcharts"));
export const OUTCOME_COLORS = {
	success: "#22c55e",
	degraded: "#06b6d4",
	no_content: "#8b5cf6",
	invalid: "#ec4899",
	failed: "#ef4444",
	limited: "#f59e0b",
	cancelled: "#64748b",
	unknown: "#94a3b8",
};

/** Zoom the axis to the values in range so a small change on a large total stays visible. */
export function fittedCountAxis(values: number[]) {
	const finite = values.filter((value) => Number.isFinite(value));
	if (finite.length === 0) return { min: 0, max: 1 };
	const lowest = Math.min(...finite);
	const highest = Math.max(...finite);
	const span = highest - lowest;
	const pad = span === 0 ? Math.max(1, Math.abs(highest) * 0.05) : span * 0.2;
	return { min: Math.max(0, lowest - pad), max: highest + pad };
}

export const TrendChart = memo(function TrendChart({
	metric,
	bucket,
	color,
	height: heightProp,
	seriesName,
	fitScale = false,
	comparison,
	stackComparison = false,
	formatValue,
}: {
	metric: AdminMetricStats;
	bucket: "hour" | "day";
	color: string;
	height?: number;
	seriesName?: string;
	fitScale?: boolean;
	formatValue?: (value: number) => string;
	comparison?: {
		name: string;
		color: string;
		metric: { points: { date: string; count: number | null }[] };
	}[];
	stackComparison?: boolean;
}) {
	const { t, i18n } = useTranslation();
	const { resolvedTheme } = useTheme();
	const isRequest = !!metric.outcomes;
	const hasBreakdown = metric.points.some(
		(point) => point.registered !== undefined || point.anonymous !== undefined,
	);
	const height = heightProp ?? (isRequest ? 180 : 120);
	const chartType =
		stackComparison || (!comparison && isRequest)
			? "bar"
			: comparison || fitScale
				? "line"
				: "area";
	const fitted = fitScale ? fittedCountAxis(metric.points.map((point) => point.count)) : undefined;
	const options = useMemo<ApexOptions>(() => {
		const locale = i18n.resolvedLanguage?.startsWith("zh") ? "zh-CN" : "en";
		const formatter = new Intl.DateTimeFormat(locale, {
			timeZone: "Asia/Singapore",
			month: "2-digit",
			day: "2-digit",
			...(bucket === "hour" ? { hour: "2-digit", hourCycle: "h23" as const } : {}),
		});
		return {
			theme: { mode: resolvedTheme },
			chart: {
				background: "transparent",
				type: chartType,
				stacked: isRequest || hasBreakdown || stackComparison,
				animations: { enabled: false },
				sparkline: { enabled: false },
				toolbar: {
					show: isRequest || hasBreakdown,
					tools: {
						download: true,
						selection: false,
						zoom: false,
						zoomin: false,
						zoomout: false,
						pan: false,
						reset: false,
					},
				},
				zoom: { enabled: false },
				foreColor: resolvedTheme === "dark" ? "#94a3b8" : "#64748b",
			},
			plotOptions: { bar: { columnWidth: "65%", borderRadius: 2 } },
			stroke: { width: chartType === "bar" ? 0 : fitScale ? 3 : 2, curve: "straight" },
			fill: { opacity: comparison || isRequest ? 1 : 0.2, type: "solid" },
			colors: comparison
				? comparison.map((item) => item.color)
				: isRequest
					? TOOL_OUTCOMES.filter(
							(outcome) => outcome === "success" || metric.outcomes?.[outcome],
						).map((outcome) => OUTCOME_COLORS[outcome])
					: hasBreakdown
						? [color, "#f59e0b"]
						: [color],
			dataLabels: { enabled: false },
			legend: { show: (!!comparison && !stackComparison) || hasBreakdown, position: "bottom" },
			grid: {
				borderColor: resolvedTheme === "dark" ? "#334155" : "#e2e8f0",
				strokeDashArray: 3,
				padding: { left: 0, right: 0 },
			},
			xaxis: {
				type: "datetime",
				axisBorder: { show: false },
				axisTicks: { show: false },
				labels: {
					hideOverlappingLabels: true,
					formatter: (value, timestamp) => formatter.format(Number(timestamp ?? value)),
				},
			},
			yaxis: {
				min: fitted?.min ?? 0,
				max: fitted?.max,
				forceNiceScale: !fitScale,
				decimalsInFloat: 0,
				labels: { formatter: formatValue ?? ((value) => Math.round(value).toLocaleString(locale)) },
			},
			tooltip: {
				shared: true,
				intersect: false,
				theme: resolvedTheme,
				x: { formatter: (value) => formatter.format(Number(value)) },
				y: { formatter: formatValue ?? ((value) => value.toLocaleString(locale)) },
			},
		};
	}, [
		isRequest,
		metric.outcomes,
		hasBreakdown,
		resolvedTheme,
		bucket,
		color,
		i18n.resolvedLanguage,
		fitScale,
		fitted?.min,
		fitted?.max,
		comparison,
		chartType,
		stackComparison,
		formatValue,
	]);
	const series = comparison
		? comparison.map((item) => ({
				name: item.name,
				data: item.metric.points.map((point) => [Date.parse(point.date), point.count]),
			}))
		: hasBreakdown
			? [
					{
						name: t("admin.stats_registered"),
						data: metric.points.map((point) => [Date.parse(point.date), point.registered ?? 0]),
					},
					{
						name: t("admin.stats_anonymous"),
						data: metric.points.map((point) => [Date.parse(point.date), point.anonymous ?? 0]),
					},
				]
			: isRequest
				? TOOL_OUTCOMES.filter(
						(outcome) => outcome === "success" || metric.outcomes?.[outcome],
					).map((outcome) => ({
						name: t(`admin.stats_${outcome}`),
						data: metric.points.map((point) => [Date.parse(point.date), point[outcome] ?? 0]),
					}))
				: [
						{
							name: seriesName ?? t("admin.stats_new_records"),
							data: metric.points.map((point) => [Date.parse(point.date), point.count]),
						},
					];

	if (metric.total === 0 && !stackComparison) {
		return (
			<div className="flex items-center justify-center text-xs text-muted" style={{ height }}>
				{t("admin.stats_empty")}
			</div>
		);
	}
	return (
		<div className="min-w-0" style={{ height }}>
			<Suspense
				fallback={
					<div className="flex h-full items-center justify-center text-xs text-muted">
						{t("admin.stats_loading")}
					</div>
				}
			>
				<ApexChart options={options} series={series} type={chartType} height={height} />
			</Suspense>
		</div>
	);
});
