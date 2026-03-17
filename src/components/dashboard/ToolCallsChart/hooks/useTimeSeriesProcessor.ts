import { useMemo } from "react";
import { createTimeKey } from "@/lib/datetime";
import type { ChartDataPoint, TimeRange } from "../types";

/**
 * 现代化的时间序列数据处理 Hook
 * 高性能、精简、优雅的数据聚合和填充
 */
export function useTimeSeriesProcessor(
	data: ChartDataPoint[],
	timeRange: TimeRange,
): ChartDataPoint[] {
	return useMemo(() => {
		if (data.length === 0) return [];

		// 数据预处理：保持原始时间数据
		const processedData = data.map((item) => ({
			...item,
			date: item.date, // 保持原始格式，让时间键生成函数处理
		}));

		// 时间聚合和填充
		return fillMissingDataPoints(processedData, timeRange);
	}, [data, timeRange]);
}

/**
 * 智能数据填充函数
 * 确保时间序列的完整性
 */
function fillMissingDataPoints(data: ChartDataPoint[], timeRange: TimeRange): ChartDataPoint[] {
	const filledData: ChartDataPoint[] = [];
	const now = new Date();

	if (timeRange === "24h") {
		// 24小时数据处理
		const hourlyDataMap = createHourlyDataMap(data);

		// 生成24小时数据点
		for (let i = 23; i >= 0; i--) {
			const currentHour = new Date(now);
			currentHour.setHours(now.getHours() - i, 0, 0, 0);
			const hourKey = createTimeKey(currentHour, {
				precision: "hour",
				useLocalTime: true,
			});

			const existingData = hourlyDataMap.get(hourKey);
			filledData.push({
				date: hourKey,
				tool_calls: existingData ? existingData.tool_calls : 0,
				results: existingData ? existingData.results : 0,
			});
		}
	} else {
		// 日数据处理
		const dailyDataMap = createDailyDataMap(data);
		const days = timeRange === "7d" ? 7 : 30;

		// 生成日数据点
		for (let i = days - 1; i >= 0; i--) {
			const currentDate = new Date(now);
			currentDate.setDate(now.getDate() - i);
			currentDate.setHours(0, 0, 0, 0);
			const dateKey = createTimeKey(currentDate, {
				precision: "day",
				useLocalTime: true,
			});

			const existingData = dailyDataMap.get(dateKey);
			filledData.push({
				date: dateKey,
				tool_calls: existingData ? existingData.tool_calls : 0,
				results: existingData ? existingData.results : 0,
			});
		}
	}

	return filledData;
}

/**
 * 创建小时数据映射
 */
function createHourlyDataMap(data: ChartDataPoint[]): Map<string, ChartDataPoint> {
	const hourlyDataMap = new Map<string, ChartDataPoint>();

	data.forEach((item) => {
		const hourKey = createTimeKey(item.date, {
			precision: "hour",
			useLocalTime: true,
		});

		const existing = hourlyDataMap.get(hourKey);
		if (existing) {
			hourlyDataMap.set(hourKey, {
				date: hourKey,
				tool_calls: existing.tool_calls + item.tool_calls,
				results: existing.results + item.results,
			});
		} else {
			hourlyDataMap.set(hourKey, {
				date: hourKey,
				tool_calls: item.tool_calls,
				results: item.results,
			});
		}
	});

	return hourlyDataMap;
}

/**
 * 创建日数据映射
 */
function createDailyDataMap(data: ChartDataPoint[]): Map<string, ChartDataPoint> {
	const dailyDataMap = new Map<string, ChartDataPoint>();

	data.forEach((item) => {
		const dateKey = createTimeKey(item.date, {
			precision: "day",
			useLocalTime: true,
		});

		const existing = dailyDataMap.get(dateKey);
		if (existing) {
			dailyDataMap.set(dateKey, {
				date: dateKey,
				tool_calls: existing.tool_calls + item.tool_calls,
				results: existing.results + item.results,
			});
		} else {
			dailyDataMap.set(dateKey, {
				date: dateKey,
				tool_calls: item.tool_calls,
				results: item.results,
			});
		}
	});

	return dailyDataMap;
}

// 自定义时间键生成函数已移除
// 现在使用统一的 createTimeKey 函数从 @/lib/datetime
