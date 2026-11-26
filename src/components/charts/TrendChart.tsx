import { memo, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { AdminMetricStats } from "@/types";
import { TOOL_OUTCOMES } from "../../../shared/tool-outcomes";
import { type ChartSeries, SvgChart } from "./SvgChart";

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
	const pad =
		span === 0
			? Math.max(1, Math.ceil(Math.abs(highest) * 0.05))
			: Math.max(1, Math.ceil(span * 0.2));
	return { min: Math.max(0, Math.floor(lowest - pad)), max: Math.ceil(highest + pad) };
}

/** Pick evenly spaced category ticks across 1..90 buckets while always showing first & last. */
export function shouldShowTrendTick(index: number, total: number): boolean {
	if (total <= 8) return true;
	if (index === 0 || index === total - 1) return true;
	const step = Math.ceil((total - 1) / 6);
	return index % step === 0 && total - 1 - index >= Math.ceil(step * 0.6);
}

/**
 * Format UTC+8 daily/hourly timeline points into explicit category buckets so
 * X-axis ticks sit directly under their data points with zero timezone offset.
 */
export function buildTrendBuckets(
	points: readonly { date: string }[],
	bucket: "hour" | "day",
	locale: string,
) {
	const axisFormat = new Intl.DateTimeFormat(locale, {
		timeZone: "Asia/Singapore",
		...(bucket === "hour"
			? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const }
			: { month: "2-digit", day: "2-digit" }),
	});
	const tooltipFormat = new Intl.DateTimeFormat(locale, {
		timeZone: "Asia/Singapore",
		month: "2-digit",
		day: "2-digit",
		...(bucket === "hour" ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const } : {}),
	});

	return points.map((point, index) => {
		const ms = Date.parse(point.date);
		const formattedAxis = Number.isFinite(ms) ? axisFormat.format(ms) : point.date;
		const formattedTooltip = Number.isFinite(ms) ? tooltipFormat.format(ms) : point.date;
		return {
			date: point.date,
			axisLabel: shouldShowTrendTick(index, points.length) ? formattedAxis : "",
			tooltipLabel: formattedTooltip,
		};
	});
}

function alignSeriesPoints<T extends { date: string }>(
	timeline: readonly { date: string }[],
	points: readonly T[],
	pick: (point: T | undefined) => number | null,
): (number | null)[] {
	if (
		points.length === timeline.length &&
		points.every((point, index) => point.date === timeline[index]?.date)
	) {
		return points.map((point) => pick(point));
	}
	const byDate = new Map(points.map((point) => [point.date, point]));
	return timeline.map((slot) => pick(byDate.get(slot.date)));
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
	const locale = i18n.resolvedLanguage?.startsWith("zh") ? "zh-CN" : "en";
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
	const timeline =
		comparison?.find((item) => item.metric.points.length > 0)?.metric.points ?? metric.points;
	const buckets = useMemo(
		() => buildTrendBuckets(timeline, bucket, locale),
		[timeline, bucket, locale],
	);
	const fitted = useMemo(
		() => (fitScale ? fittedCountAxis(metric.points.map((point) => point.count)) : undefined),
		[fitScale, metric.points],
	);

	const series: ChartSeries[] = useMemo(() => {
		if (comparison) {
			return comparison.map((item) => ({
				name: item.name,
				color: item.color,
				data: alignSeriesPoints(timeline, item.metric.points, (point) => point?.count ?? null),
			}));
		}
		if (hasBreakdown) {
			return [
				{
					name: t("admin.stats_registered"),
					color,
					data: metric.points.map((point) => point.registered ?? 0),
				},
				{
					name: t("admin.stats_anonymous"),
					color: "#f59e0b",
					data: metric.points.map((point) => point.anonymous ?? 0),
				},
			];
		}
		if (isRequest) {
			return TOOL_OUTCOMES.filter(
				(outcome) => outcome === "success" || metric.outcomes?.[outcome],
			).map((outcome) => ({
				name: t(`admin.stats_${outcome}`),
				color: OUTCOME_COLORS[outcome],
				data: metric.points.map((point) => point[outcome] ?? 0),
			}));
		}
		return [
			{
				name: seriesName ?? t("admin.stats_new_records"),
				color,
				data: metric.points.map((point) => point.count),
			},
		];
	}, [comparison, timeline, hasBreakdown, isRequest, metric, color, seriesName, t]);

	const formatAxisValue = useCallback(
		(value: number) =>
			!Number.isFinite(value)
				? "—"
				: formatValue
					? formatValue(value)
					: Math.round(value).toLocaleString(locale),
		[formatValue, locale],
	);

	const formatTooltipValue = useCallback(
		(value: number | null) =>
			value === null || !Number.isFinite(value)
				? "—"
				: formatValue
					? formatValue(value)
					: value.toLocaleString(locale),
		[formatValue, locale],
	);

	if (metric.total === 0 && !stackComparison) {
		return (
			<div className="flex items-center justify-center text-xs text-muted" style={{ height }}>
				{t("admin.stats_empty")}
			</div>
		);
	}

	return (
		<div className="min-w-0" style={{ height }}>
			<SvgChart
				type={chartType}
				buckets={buckets}
				series={series}
				height={height}
				stacked={isRequest || hasBreakdown || stackComparison}
				fitBounds={fitted}
				strokeWidth={fitScale ? 3 : 2}
				showLegend={(!!comparison && !stackComparison) || hasBreakdown}
				showExport={isRequest || hasBreakdown}
				exportFilename={`${seriesName ?? "trend"}.csv`}
				ariaLabel={seriesName ?? t("admin.stats_new_records")}
				formatAxisValue={formatAxisValue}
				formatTooltipValue={formatTooltipValue}
			/>
		</div>
	);
});
