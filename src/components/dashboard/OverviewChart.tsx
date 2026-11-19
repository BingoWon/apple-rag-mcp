import type { ApexOptions } from "apexcharts";
import { lazy, Suspense, useId } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/components/providers/ThemeProvider";
import { TOOL_KINDS, type ToolActivity } from "../../../shared/tool-activity";

const ApexChart = lazy(() => import("react-apexcharts"));
const overviewColors = { search: "#128b84", fetch: "#5868d9", browse: "#bd4393" };
const nightColors = { search: "#39dfcf", fetch: "#99a7ff", browse: "#f09fdb" };
export const overviewPalette = (dark: boolean) => (dark ? nightColors : overviewColors);
export function CallsSparkline({ points }: { points: ToolActivity["points"] }) {
	const id = useId();
	const values = points.map((p) => p.search + p.fetch + p.browse);
	if (!values.length) return null;
	const ceiling = Math.max(1, ...values);
	const coords = values.map((v, i) => [
		(i * 240) / Math.max(1, values.length - 1),
		48 - (v / ceiling) * 41,
	]);
	if (coords.length === 1) coords.push([240, coords[0][1]]);
	const line = coords.slice(1).reduce((s, [x, y], i) => {
		const [px, py] = coords[i];
		const mid = (px + x) / 2;
		return s + ` C${mid},${py} ${mid},${y} ${x},${y}`;
	}, `M0,${coords[0][1]}`);
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 240 54"
			preserveAspectRatio="none"
			width="100%"
			height="100%"
		>
			<defs>
				<linearGradient id={id} x2="1" y2="0">
					<stop stopColor="hsl(var(--chart-1))" />
					<stop offset="1" stopColor="hsl(var(--chart-2))" />
				</linearGradient>
			</defs>
			<path d={line + " V54 H0 Z"} fill={`url(#${id})`} opacity=".22" />
			<path
				d={line}
				fill="none"
				stroke={`url(#${id})`}
				strokeWidth="2.5"
				vectorEffect="non-scaling-stroke"
			/>
		</svg>
	);
}
export function OverviewChart({ data }: { data: ToolActivity }) {
	const { t, i18n } = useTranslation();
	const { resolvedTheme } = useTheme();
	const dark = resolvedTheme === "dark",
		axis = dark ? "#94a3b8" : "#64748b";
	const colors = overviewPalette(dark);
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
		colors: TOOL_KINDS.map((k) => colors[k]),
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
					series={TOOL_KINDS.map((k) => ({
						name: t("activity." + k),
						data: data.points.map((p) => [Date.parse(p.date), p[k]]),
					}))}
				/>
			</Suspense>
		</div>
	);
}
