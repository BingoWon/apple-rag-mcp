import type { ApexOptions } from "apexcharts";
import { lazy, memo, Suspense, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/components/providers/ThemeProvider";
import type { AdminMetricStats } from "@/types";

const ApexChart = lazy(() => import("react-apexcharts"));
export const OUTCOME_COLORS = {
	success: "#22c55e",
	failed: "#ef4444",
	limited: "#f59e0b",
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

export const AdminTrendChart = memo(function AdminTrendChart({
	metric,
	bucket,
	color,
	height: heightProp,
	seriesName,
	fitScale = false,
}: {
	metric: AdminMetricStats;
	bucket: "hour" | "day";
	color: string;
	height?: number;
	seriesName?: string;
	fitScale?: boolean;
}) {
	const { t, i18n } = useTranslation();
	const { resolvedTheme } = useTheme();
	const isRequest = !!metric.outcomes;
	const hasBreakdown = metric.points.some(
		(point) => point.registered !== undefined || point.anonymous !== undefined,
	);
	const height = heightProp ?? (isRequest ? 180 : 120);
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
				type: isRequest ? "bar" : fitScale ? "line" : "area",
				stacked: isRequest || hasBreakdown,
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
			stroke: { width: isRequest ? 0 : fitScale ? 3 : 2, curve: "straight" },
			fill: { opacity: isRequest ? 1 : 0.2, type: "solid" },
			colors: isRequest
				? Object.values(OUTCOME_COLORS)
				: hasBreakdown
					? [color, "#f59e0b"]
					: [color],
			dataLabels: { enabled: false },
			legend: { show: hasBreakdown, position: "bottom" },
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
				labels: { formatter: (value) => Math.round(value).toLocaleString(locale) },
			},
			tooltip: {
				shared: true,
				intersect: false,
				theme: resolvedTheme,
				x: { formatter: (value) => formatter.format(Number(value)) },
				y: { formatter: (value) => value.toLocaleString(locale) },
			},
		};
	}, [
		isRequest,
		hasBreakdown,
		resolvedTheme,
		bucket,
		color,
		i18n.resolvedLanguage,
		fitScale,
		fitted?.min,
		fitted?.max,
	]);
	const series = hasBreakdown
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
			? (["success", "failed", "limited", "unknown"] as const)
					.filter((outcome) => outcome !== "unknown" || metric.outcomes?.unknown)
					.map((outcome) => ({
						name: t(`admin.stats_${outcome}`),
						data: metric.points.map((point) => [Date.parse(point.date), point[outcome] ?? 0]),
					}))
			: [
					{
						name: seriesName ?? t("admin.stats_new_records"),
						data: metric.points.map((point) => [Date.parse(point.date), point.count]),
					},
				];

	if (metric.total === 0) {
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
				<ApexChart
					options={options}
					series={series}
					type={isRequest ? "bar" : fitScale ? "line" : "area"}
					height={height}
				/>
			</Suspense>
		</div>
	);
});
