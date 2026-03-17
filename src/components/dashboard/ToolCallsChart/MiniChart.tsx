import { lazy, memo, Suspense } from "react";
import { LoaderFive } from "@/components/ui/loader";
import type { MiniChartProps } from "./types";

const ApexChart = lazy(() => import("react-apexcharts"));

/**
 * 现代化的迷你图表组件
 * 优雅、精简、高性能
 */
const MiniChart = memo<MiniChartProps>(
	({ type, data, isSelected: _isSelected, isDark: _isDark }) => {
		// 数据处理：提取对应类型的数值
		const chartData = data.map((item) => (type === "results" ? item.results : item.tool_calls));

		// 精简的图表配置
		const chartOptions = {
			chart: {
				type: "line" as const,
				height: 64,
				sparkline: { enabled: true },
				toolbar: { show: false },
				animations: {
					enabled: true,
					speed: 600,
					animateGradually: {
						enabled: true,
						delay: 100,
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
			stroke: {
				curve: "smooth" as const,
				width: 3,
			},
			fill: {
				type: "gradient",
				gradient: {
					type: "linear",
					gradientToColors: [type === "tool_calls" ? "hsl(var(--chart-2))" : "hsl(var(--chart-4))"],
					shadeIntensity: 1,
					opacityFrom: 0.7,
					opacityTo: 0.3,
					stops: [0, 100],
				},
			},
			colors: [type === "tool_calls" ? "hsl(var(--chart-1))" : "hsl(var(--chart-3))"],
			markers: { size: 0 },
			grid: { padding: { top: 0, bottom: 4, left: 0, right: 0 } },
			dataLabels: { enabled: false },
			tooltip: {
				enabled: true,
				theme: "dark",
				fixed: { enabled: false },
				x: { show: false },
				y: { title: { formatter: () => "" } },
				marker: { show: false },
			},
			xaxis: {
				labels: { show: false },
				axisBorder: { show: false },
				axisTicks: { show: false },
			},
			yaxis: {
				labels: { show: false },
				min: 0,
			},
		};

		const series = [
			{
				name: type === "tool_calls" ? "Tool Calls" : "Results",
				data: chartData,
			},
		];

		return (
			<div className="h-16 w-full">
				<Suspense
					fallback={
						<div className="flex items-center justify-center h-16">
							<div className="scale-75">
								<LoaderFive text="Loading..." />
							</div>
						</div>
					}
				>
					<ApexChart options={chartOptions} series={series} type="area" height={64} />
				</Suspense>
			</div>
		);
	},
);

MiniChart.displayName = "MiniChart";

export default MiniChart;
