import { lazy, memo, Suspense, useMemo } from "react";
import { LoaderFive } from "@/components/ui/loader";
import type { MainChartProps } from "./types";

const ApexChart = lazy(() => import("react-apexcharts"));

/**
 * 现代化的主图表组件
 * 高性能、响应式、优雅的数据可视化
 */
const MainChart = memo<MainChartProps>(({ data, selectedCharts, colors }) => {
	// 使用 useMemo 优化图表配置
	const chartOptions = useMemo(
		() => ({
			chart: {
				type: "line" as const,
				height: 400,
				foreColor: colors.axis,
				toolbar: { show: false },
				zoom: { enabled: false },
				animations: {
					enabled: true,
					speed: 800,
					animateGradually: {
						enabled: true,
						delay: 150,
					},
					dynamicAnimation: {
						enabled: true,
						speed: 350,
					},
				},
				dropShadow: {
					enabled: true,
					top: 1,
					left: 1,
					blur: 2,
					opacity: 0.5,
				},
			},
			dataLabels: { enabled: false },
			legend: {
				show: true,
				position: "bottom" as const,
				horizontalAlign: "center" as const,
				fontSize: "14px",
				fontWeight: 500,
				labels: { colors: colors.text },
				markers: { size: 8 },
				showForSingleSeries: true,
			},
			responsive: [
				{
					breakpoint: 768,
					options: { chart: { height: 300 } },
				},
			],
			stroke: {
				curve: "smooth" as const,
				width: 3,
				colors: [
					...(selectedCharts.includes("tool_calls") ? ["hsl(var(--chart-1))"] : []),
					...(selectedCharts.includes("results") ? ["hsl(var(--chart-3))"] : []),
				],
			},
			colors: [
				...(selectedCharts.includes("tool_calls") ? ["hsl(var(--chart-1))"] : []),
				...(selectedCharts.includes("results") ? ["hsl(var(--chart-3))"] : []),
			],
			fill: {
				type: "solid",
				opacity: 0.2,
			},
			grid: {
				borderColor: colors.axis,
				strokeDashArray: 3,
				xaxis: { lines: { show: true } },
				yaxis: { lines: { show: true } },
				padding: { top: 0, right: 30, bottom: 0, left: 20 },
			},
			xaxis: {
				type: "datetime" as const,
				labels: {
					style: { colors: colors.axis, fontSize: "12px" },
					datetimeUTC: false,
				},
				axisBorder: { show: false },
				axisTicks: { show: false },
			},
			yaxis: {
				labels: {
					style: { colors: colors.axis, fontSize: "12px" },
					formatter: (value: number) => Math.round(value).toLocaleString(),
				},
				min: 0,
			},
			tooltip: {
				shared: true,
				intersect: false,
				theme: "dark",
				style: { fontSize: "12px" },
				x: {
					format: "MMM dd, HH:mm",
				},
				y: {
					formatter: (value: number, { seriesIndex }: { seriesIndex: number }) => {
						const isToolCallsSeries = selectedCharts.includes("tool_calls") && seriesIndex === 0;
						const isResultSeries =
							selectedCharts.includes("results") &&
							(selectedCharts.includes("tool_calls") ? seriesIndex === 1 : seriesIndex === 0);

						let unit = "";
						if (isToolCallsSeries) unit = "Tool Calls";
						if (isResultSeries) unit = "Results";

						return `${Math.round(value).toLocaleString()} ${unit}`;
					},
				},
			},
		}),
		[selectedCharts, colors],
	);

	// 使用 useMemo 优化系列数据
	const series = useMemo(
		() => [
			...(selectedCharts.includes("tool_calls")
				? [
						{
							name: "Tool Calls",
							data: data.map((item) => [new Date(item.date).getTime(), item.tool_calls]),
						},
					]
				: []),
			...(selectedCharts.includes("results")
				? [
						{
							name: "Results",
							data: data.map((item) => [new Date(item.date).getTime(), item.results]),
						},
					]
				: []),
		],
		[data, selectedCharts],
	);

	return (
		<div className="h-[400px]">
			<Suspense
				fallback={
					<div className="flex items-center justify-center h-full">
						<LoaderFive text="Loading chart..." />
					</div>
				}
			>
				<ApexChart options={chartOptions} series={series} type="line" height={400} />
			</Suspense>
		</div>
	);
});

MainChart.displayName = "MainChart";

export default MainChart;
