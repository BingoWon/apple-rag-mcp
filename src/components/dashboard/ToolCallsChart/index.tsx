import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useTheme } from "@/hooks/useTheme";
import { useDashboardStore } from "@/stores/dashboard";
import ErrorDisplay from "./ErrorDisplay";
import { useTimeSeriesProcessor } from "./hooks/useTimeSeriesProcessor";
import MainChart from "./MainChart";
import StatsCard from "./StatsCard";
import TimeRangeSelector from "./TimeRangeSelector";
import type { ChartType, TimeRange, ToolCallsChartProps } from "./types";

/**
 * Modern Tool Calls Chart Component
 * Elegant, high-performance, modular data visualization for MCP analytics
 */
export function ToolCallsChart({
	data,
	totalToolCalls = 0,
	totalResults = 0,
}: ToolCallsChartProps) {
	const { t } = useTranslation();

	// 状态管理
	const [selectedCharts, setSelectedCharts] = useState<ChartType[]>(["tool_calls"]);
	const [timeRange, setTimeRange] = useState<TimeRange>("7d");

	// Hooks
	const { resolvedTheme } = useTheme();
	const { fetchToolCallsStats, errors, clearError } = useDashboardStore();

	// 计算值
	const isDark = resolvedTheme === "dark";
	const colors = useMemo(
		() => ({
			text: isDark ? "#f1f5f9" : "#0f172a",
			activeText: isDark ? "#ffffff" : "#0f172a",
			axis: isDark ? "#94a3b8" : "#64748b",
		}),
		[isDark],
	);

	// 数据处理
	const processedData = useTimeSeriesProcessor(data, timeRange);

	// 计算显示的总数
	const displayTotalToolCalls =
		totalToolCalls || data.reduce((sum, item) => sum + item.tool_calls, 0);
	const displayTotalResults =
		totalResults || data.reduce((sum, item) => sum + (item.results || 0), 0);

	// 事件处理
	const handleChartToggle = useCallback((chartType: ChartType) => {
		setSelectedCharts((prev) => {
			const isSelected = prev.includes(chartType);

			if (isSelected) {
				// 如果当前图表已选中，且还有其他图表选中，则可以取消当前的
				if (prev.length > 1) {
					return prev.filter((chart) => chart !== chartType);
				}
				// 如果只有当前图表选中，则不能取消（必须至少有一个）
				return prev;
			} else {
				// 如果当前图表未选中，则添加到选中列表
				return [...prev, chartType];
			}
		});
	}, []);

	const handleTimeRangeChange = useCallback(
		async (newRange: TimeRange) => {
			// 清除之前的错误状态
			if (errors.usage) {
				clearError("usage");
			}

			// 立即更新 UI 状态
			setTimeRange(newRange);

			// 获取新的工具调用统计数据
			await fetchToolCallsStats(newRange);
		},
		[errors.usage, clearError, fetchToolCallsStats],
	);

	const handleClearError = useCallback(() => {
		clearError("usage");
	}, [clearError]);

	// 初始化数据获取
	useEffect(() => {
		fetchToolCallsStats(timeRange);
	}, [fetchToolCallsStats, timeRange]); // 只在组件挂载时执行一次

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle>{t("chart.usage_trends")}</CardTitle>
					<TimeRangeSelector timeRange={timeRange} onTimeRangeChange={handleTimeRangeChange} />
				</div>
			</CardHeader>
			<CardContent className="p-0 pb-4">
				{/* 错误显示 */}
				{errors.usage && (
					<div className="px-6 pt-6">
						<ErrorDisplay error={errors.usage} onClearError={handleClearError} />
					</div>
				)}

				{/* 统计卡片区域 */}
				<div className="px-6">
					<div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
						<StatsCard
							type="tool_calls"
							data={processedData}
							totalValue={displayTotalToolCalls}
							isSelected={selectedCharts.includes("tool_calls")}
							isDark={isDark}
							colors={colors}
							onToggle={handleChartToggle}
						/>
						<StatsCard
							type="results"
							data={processedData}
							totalValue={displayTotalResults}
							isSelected={selectedCharts.includes("results")}
							isDark={isDark}
							colors={colors}
							onToggle={handleChartToggle}
						/>
					</div>
				</div>

				{/* 主图表区域 */}
				<MainChart data={processedData} selectedCharts={selectedCharts} colors={colors} />
			</CardContent>
		</Card>
	);
}

export default ToolCallsChart;
