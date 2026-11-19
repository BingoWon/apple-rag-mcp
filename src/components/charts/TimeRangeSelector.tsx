import { useTranslation } from "react-i18next";
import type { UsagePeriod } from "../../../shared/tool-activity";
export default function TimeRangeSelector({
	timeRange,
	onTimeRangeChange,
	presentation = "compact",
}: {
	timeRange?: UsagePeriod;
	presentation?: "compact" | "overview";
	onTimeRangeChange: (r: UsagePeriod) => void;
}) {
	const { t } = useTranslation();
	return (
		<div
			className={
				presentation === "overview"
					? "flex flex-wrap gap-2"
					: "inline-flex gap-0.5 rounded-lg border border-default bg-background p-0.5"
			}
		>
			{(["24h", "7d", "30d"] as const).map((r) => (
				<button
					type="button"
					key={r}
					aria-pressed={r === timeRange}
					onClick={() => onTimeRangeChange(r)}
					className={
						presentation === "overview"
							? `inline-flex h-9 items-center justify-center rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-brand ${r === timeRange ? "bg-brand text-white shadow-complex" : "border border-default bg-transparent text-muted hover:bg-secondary hover:text-light"}`
							: `min-h-9 rounded-md px-2.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-brand ${r === timeRange ? "bg-card text-brand shadow-sm ring-1 ring-inset ring-default" : "text-muted hover:text-light"}`
					}
				>
					{t(`chart.last_${r}`)}
				</button>
			))}
		</div>
	);
}
