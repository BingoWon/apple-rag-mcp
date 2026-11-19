import { useTranslation } from "react-i18next";
import type { UsagePeriod } from "../../../shared/tool-activity";
export default function TimeRangeSelector({
	timeRange,
	onTimeRangeChange,
}: {
	timeRange?: UsagePeriod;
	onTimeRangeChange: (r: UsagePeriod) => void;
}) {
	const { t } = useTranslation();
	return (
		<div className="inline-flex gap-0.5 rounded-lg border border-default bg-background p-0.5">
			{(["24h", "7d", "30d"] as const).map((r) => (
				<button
					type="button"
					key={r}
					aria-pressed={r === timeRange}
					onClick={() => onTimeRangeChange(r)}
					className={`min-h-9 rounded-md px-2.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-brand ${r === timeRange ? "bg-card text-brand shadow-sm ring-1 ring-inset ring-default" : "text-muted hover:text-light"}`}
				>
					{t(`chart.last_${r}`)}
				</button>
			))}
		</div>
	);
}
