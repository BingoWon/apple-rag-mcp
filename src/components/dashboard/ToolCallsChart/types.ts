/**
 * Tool Calls Chart Component Type Definitions
 * Modern, streamlined type system for MCP tool call analytics
 */

export interface ChartDataPoint {
	date: string;
	tool_calls: number;
	results: number;
}

export type TimeRange = "24h" | "7d" | "30d";
export type ChartType = "tool_calls" | "results";

export interface ToolCallsChartProps {
	data: ChartDataPoint[];
	totalToolCalls?: number;
	totalResults?: number;
}

export interface ChartColors {
	text: string;
	activeText: string;
	axis: string;
}

export interface MiniChartProps {
	type: ChartType;
	data: ChartDataPoint[];
	isSelected: boolean;
	isDark: boolean;
}

export interface MainChartProps {
	data: ChartDataPoint[];
	selectedCharts: ChartType[];
	colors: ChartColors;
}

export interface TimeRangeSelectorProps {
	timeRange: TimeRange;
	onTimeRangeChange: (range: TimeRange) => void;
}

export interface ErrorDisplayProps {
	error: string | null;
	onClearError: () => void;
}
