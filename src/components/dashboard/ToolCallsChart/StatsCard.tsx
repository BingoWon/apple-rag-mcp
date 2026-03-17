import { IconCircleCheck, IconSearch } from "@tabler/icons-react";
import { memo } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import MiniChart from "./MiniChart";
import type { ChartColors, ChartDataPoint, ChartType } from "./types";

interface StatsCardProps {
	type: ChartType;
	data: ChartDataPoint[];
	totalValue: number;
	isSelected: boolean;
	isDark: boolean;
	colors: ChartColors;
	onToggle: (type: ChartType) => void;
}

/**
 * 现代化的统计卡片组件
 * 优雅的设计，流畅的交互
 */
const StatsCard = memo<StatsCardProps>(
	({ type, data, totalValue, isSelected, isDark, colors, onToggle }) => {
		const isToolCalls = type === "tool_calls";
		const title = isToolCalls ? "Tool Calls" : "Results";
		const Icon = isToolCalls ? IconSearch : IconCircleCheck;
		const colorVar = isToolCalls
			? "var(--color-chart-queries, #2AFADF)"
			: "var(--color-chart-results, #EE9AE5)";

		// 优雅的背景渐变
		const backgroundImage = isSelected
			? isDark
				? isToolCalls
					? "radial-gradient(circle at 20% 80%, rgba(42, 250, 223, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(76, 131, 255, 0.3) 0%, transparent 50%), radial-gradient(circle at 40% 40%, rgba(42, 250, 223, 0.1) 0%, transparent 50%)"
					: "radial-gradient(circle at 20% 80%, rgba(238, 154, 229, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(89, 97, 249, 0.3) 0%, transparent 50%), radial-gradient(circle at 40% 40%, rgba(238, 154, 229, 0.1) 0%, transparent 50%)"
				: isToolCalls
					? "radial-gradient(circle at 20% 80%, rgba(42, 250, 223, 0.4) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(76, 131, 255, 0.4) 0%, transparent 60%), radial-gradient(circle at 40% 40%, rgba(42, 250, 223, 0.15) 0%, transparent 60%)"
					: "radial-gradient(circle at 20% 80%, rgba(238, 154, 229, 0.4) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(89, 97, 249, 0.4) 0%, transparent 60%), radial-gradient(circle at 40% 40%, rgba(238, 154, 229, 0.15) 0%, transparent 60%)"
			: isDark
				? isToolCalls
					? "radial-gradient(circle at 20% 80%, rgba(42, 250, 223, 0.05) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(76, 131, 255, 0.05) 0%, transparent 50%), radial-gradient(circle at 40% 40%, rgba(42, 250, 223, 0.02) 0%, transparent 50%)"
					: "radial-gradient(circle at 20% 80%, rgba(238, 154, 229, 0.05) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(89, 97, 249, 0.05) 0%, transparent 50%), radial-gradient(circle at 40% 40%, rgba(238, 154, 229, 0.02) 0%, transparent 50%)"
				: isToolCalls
					? "radial-gradient(circle at 20% 80%, rgba(42, 250, 223, 0.08) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(76, 131, 255, 0.08) 0%, transparent 60%), radial-gradient(circle at 40% 40%, rgba(42, 250, 223, 0.03) 0%, transparent 60%)"
					: "radial-gradient(circle at 20% 80%, rgba(238, 154, 229, 0.08) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(89, 97, 249, 0.08) 0%, transparent 60%), radial-gradient(circle at 40% 40%, rgba(238, 154, 229, 0.03) 0%, transparent 60%)";

		return (
			<Card
				className={`cursor-pointer transition-all duration-200 overflow-hidden ${
					isSelected ? "ring-2 shadow-lg" : "opacity-60 hover:opacity-80"
				}`}
				onClick={() => onToggle(type)}
				style={{
					...(isSelected &&
						({
							"--tw-ring-color": isToolCalls
								? "var(--color-chart-queries)"
								: "var(--color-chart-results)",
						} as React.CSSProperties)),
					backgroundImage,
				}}
			>
				<CardContent className="p-0">
					{/* 文本内容区域 */}
					<div className="px-6 pt-4 pb-0">
						<div className="flex items-start justify-between">
							<div>
								<h3
									className="text-xl font-bold"
									style={{
										color: isSelected ? colors.activeText : colors.text,
									}}
								>
									{title}
								</h3>
								<p
									className="text-3xl font-bold mt-2"
									style={{
										color: isSelected ? colors.activeText : colors.text,
									}}
								>
									{totalValue.toLocaleString()}
								</p>
							</div>
							<Icon
								className={`h-8 w-8 ${isSelected ? "" : "opacity-60"}`}
								style={{ color: colorVar }}
							/>
						</div>
					</div>
					{/* 图表区域 */}
					<div className="h-16 -ml-1 -mb-1">
						<MiniChart type={type} data={data} isSelected={isSelected} isDark={isDark} />
					</div>
				</CardContent>
			</Card>
		);
	},
);

StatsCard.displayName = "StatsCard";

export default StatsCard;
