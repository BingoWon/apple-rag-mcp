import { useCallback, useId, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { TOOL_KINDS, type ToolActivity, type ToolKind } from "../../../shared/tool-activity";
import { SvgChart } from "../charts/SvgChart";

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
			date: point.date,
			axisLabel: shouldShowBucketTick(index, points.length) ? axisFormat.format(ms) : "",
			tooltipLabel: tooltipFormat.format(ms),
		};
	});
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
	const locale = i18n.resolvedLanguage ?? "en";
	const numberFormat = useMemo(() => new Intl.NumberFormat(locale), [locale]);
	const buckets = useMemo(
		() => formatActivityBuckets(data.points, data.bucket, locale),
		[data.points, data.bucket, locale],
	);
	const series = useMemo(
		() =>
			TOOL_KINDS.filter((k) => data.by_tool[k] > 0).map((k) => ({
				name: t(`activity.${k}`),
				color: colors[k],
				data: data.points.map((p) => p[k]),
			})),
		[data.by_tool, data.points, colors, t],
	);
	const formatAxis = useCallback(
		(value: number) => numberFormat.format(Math.round(value)),
		[numberFormat],
	);
	const formatTooltip = useCallback(
		(value: number | null) =>
			value === null || !Number.isFinite(value) ? "—" : numberFormat.format(Math.round(value)),
		[numberFormat],
	);

	return (
		<div className="h-64 min-w-0 sm:h-80">
			<SvgChart
				type="bar"
				buckets={buckets}
				series={series}
				height="100%"
				stacked
				ariaLabel={t("chart.usage_trends")}
				formatAxisValue={formatAxis}
				formatTooltipValue={formatTooltip}
			/>
		</div>
	);
}
