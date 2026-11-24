import type { ApexOptions } from "apexcharts";
import { Suspense } from "react";
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

function curve(points: Point[]): string {
	return points.slice(1).reduce((line, [x, y], i) => {
		const [px, py] = points[i];
		const mid = (px + x) / 2;
		return line + ` C${mid},${py} ${mid},${y} ${x},${y}`;
	}, points[0].join(","));
}

export function CallsSparkline({ data, colors }: { data: ToolActivity; colors: Palette }) {
	const { points } = data;
	if (!data.total || !points.length) return null;
	const max = Math.max(1, ...points.map((p) => p.search + p.fetch + p.browse));
	const samples = points.length === 1 ? [points[0], points[0]] : points;
	let lower: Point[] = samples.map((_, i) => [(i * 240) / (samples.length - 1), 50]);
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 240 54"
			preserveAspectRatio="none"
			width="100%"
			height="100%"
		>
			{TOOL_KINDS.filter((k) => data.by_tool[k] > 0).map((k) => {
				const upper: Point[] = lower.map(([x, y], i) => [x, y - (samples[i][k] * 43) / max]);
				const edge = "M" + curve(upper);
				const band = edge + " L" + curve([...lower].reverse()) + " Z";
				lower = upper;
				return (
					<g key={k}>
						<path d={band} fill={colors[k]} fillOpacity=".20" />
						<path
							d={edge}
							fill="none"
							stroke={colors[k]}
							strokeWidth="1.8"
							vectorEffect="non-scaling-stroke"
						/>
					</g>
				);
			})}
		</svg>
	);
}
export function OverviewChart({ data, colors }: { data: ToolActivity; colors: Palette }) {
	const { t, i18n } = useTranslation();
	const { resolvedTheme } = useTheme();
	const dark = resolvedTheme === "dark",
		axis = dark ? "#94a3b8" : "#64748b";
	const visible = TOOL_KINDS.filter((k) => data.by_tool[k] > 0);
	const date = new Intl.DateTimeFormat(i18n.resolvedLanguage, {
		timeZone: "Asia/Singapore",
		month: "short",
		day: "numeric",
		...(data.bucket === "hour" ? { hour: "2-digit", hourCycle: "h23" as const } : {}),
	});
	const options: ApexOptions = {
		chart: {
			type: "area",
			stacked: true,
			background: "transparent",
			toolbar: { show: false },
			zoom: { enabled: false },
			animations: { enabled: false },
			foreColor: axis,
		},
		theme: { mode: dark ? "dark" : "light" },
		colors: visible.map((k) => colors[k]),
		stroke: { curve: "smooth", width: 2.5 },
		fill: { type: "gradient", gradient: { opacityFrom: 0.34, opacityTo: 0.05, stops: [0, 100] } },
		markers: { size: 0 },
		dataLabels: { enabled: false },
		legend: { show: false },
		grid: {
			borderColor: dark ? "#344155" : "#cbd5e1",
			strokeDashArray: 3,
			xaxis: { lines: { show: true } },
			padding: { left: 4, right: 12 },
		},
		xaxis: {
			type: "datetime",
			labels: {
				hideOverlappingLabels: true,
				formatter: (v, stamp) => date.format(Number(stamp ?? v)),
			},
			axisTicks: { show: false },
			axisBorder: { show: false },
		},
		yaxis: {
			min: 0,
			forceNiceScale: true,
			labels: { formatter: (v) => Math.round(v).toLocaleString(i18n.resolvedLanguage) },
		},
		tooltip: {
			shared: true,
			intersect: false,
			theme: dark ? "dark" : "light",
			x: { formatter: (v) => date.format(Number(v)) },
		},
	};
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
					type="area"
					width="100%"
					height="100%"
					options={options}
					series={visible.map((k) => ({
						name: t("activity." + k),
						data: data.points.map((p) => [Date.parse(p.date), p[k]]),
					}))}
				/>
			</Suspense>
		</div>
	);
}
