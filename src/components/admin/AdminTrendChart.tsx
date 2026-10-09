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

export const AdminTrendChart = memo(function AdminTrendChart({
	metric,
	bucket,
	color,
}: {
	metric: AdminMetricStats;
	bucket: "hour" | "day";
	color: string;
}) {
	const { t, i18n } = useTranslation();
	const { resolvedTheme } = useTheme();
	const isRequest = !!metric.outcomes;
	const height = isRequest ? 190 : 80;
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
				type: isRequest ? "bar" : "area",
				stacked: isRequest,
				animations: { enabled: false },
				sparkline: { enabled: !isRequest },
				toolbar: {
					show: isRequest,
					tools: {
						download: true,
						selection: false,
						zoom: true,
						zoomin: true,
						zoomout: true,
						pan: true,
						reset: true,
					},
				},
				zoom: { enabled: isRequest, type: "x", autoScaleYaxis: false },
				foreColor: resolvedTheme === "dark" ? "#94a3b8" : "#64748b",
			},
			plotOptions: { bar: { columnWidth: "65%", borderRadius: 2 } },
			stroke: { width: isRequest ? 0 : 2, curve: "straight" },
			fill: { opacity: isRequest ? 1 : 0.15, type: "solid" },
			colors: isRequest ? Object.values(OUTCOME_COLORS) : [color],
			dataLabels: { enabled: false },
			legend: { show: false },
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
				min: 0,
				forceNiceScale: true,
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
	}, [isRequest, resolvedTheme, bucket, color, i18n.resolvedLanguage]);
	const series = isRequest
		? (["success", "failed", "limited", "unknown"] as const)
				.filter((outcome) => outcome !== "unknown" || metric.outcomes?.unknown)
				.map((outcome) => ({
					name: t(`admin.stats_${outcome}`),
					data: metric.points.map((point) => [Date.parse(point.date), point[outcome] ?? 0]),
				}))
		: [
				{
					name: t("admin.stats_new_records"),
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
					type={isRequest ? "bar" : "area"}
					height={height}
				/>
			</Suspense>
		</div>
	);
});
