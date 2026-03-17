import { memo, useCallback } from "react";
import type { TimeRange, TimeRangeSelectorProps } from "./types";

const TIME_RANGE_OPTIONS = [
	{ key: "24h" as const, label: "Last 24h" },
	{ key: "7d" as const, label: "Last 7d" },
	{ key: "30d" as const, label: "Last 30d" },
] as const;

/**
 * 现代化的时间范围选择器
 * 优雅的交互设计，支持键盘操作
 */
const TimeRangeSelector = memo<TimeRangeSelectorProps>(({ timeRange, onTimeRangeChange }) => {
	const handleClick = useCallback(
		(range: TimeRange) => {
			onTimeRangeChange(range);
		},
		[onTimeRangeChange],
	);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent, range: TimeRange) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				e.stopPropagation();
				onTimeRangeChange(range);
			}
		},
		[onTimeRangeChange],
	);

	return (
		<div className="flex gap-2">
			{TIME_RANGE_OPTIONS.map(({ key, label }) => (
				<div
					key={key}
					role="button"
					tabIndex={0}
					className={`inline-flex items-center justify-center rounded-md text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer relative h-9 px-3 transition-all duration-200 select-none ${
						timeRange === key
							? "bg-brand text-white font-semibold shadow-complex hover:bg-brand/90 border-brand"
							: "border border-default bg-transparent text-muted font-medium hover:bg-secondary hover:text-light hover:border-light"
					}`}
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						handleClick(key);
					}}
					onKeyDown={(e) => handleKeyDown(e, key)}
				>
					{label}
				</div>
			))}
		</div>
	);
});

TimeRangeSelector.displayName = "TimeRangeSelector";

export default TimeRangeSelector;
