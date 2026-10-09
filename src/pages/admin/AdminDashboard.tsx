import { IconCalendar, IconCheck, IconRefresh } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminStatsCards } from "@/components/admin/AdminStatsCards";
import TimeRangeSelector from "@/components/dashboard/ToolCallsChart/TimeRangeSelector";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import type { AdminDashboardStats, AdminStatsQuery } from "@/types";

export default function AdminDashboard() {
	const { t, i18n } = useTranslation();
	const [query, setQuery] = useState<AdminStatsQuery>({ period: "7d" });
	const [stats, setStats] = useState<AdminDashboardStats | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);
	const [customOpen, setCustomOpen] = useState(false);
	const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(Date.now());
	const [customStart, setCustomStart] = useState(today);
	const [customEnd, setCustomEnd] = useState(today);
	const [rangeError, setRangeError] = useState(false);

	useEffect(() => {
		const controller = new AbortController();
		setLoading(true);
		setError(false);
		setStats(null);
		api
			.getAdminStats(query, controller.signal)
			.then((response) => {
				if (!controller.signal.aborted) {
					if (!response.success || !response.data) throw new Error("Statistics unavailable");
					setStats(response.data);
				}
			})
			.catch(() => {
				if (!controller.signal.aborted) setError(true);
			})
			.finally(() => {
				if (!controller.signal.aborted) setLoading(false);
			});
		return () => controller.abort();
	}, [query]);

	const locale = i18n.resolvedLanguage?.startsWith("zh") ? "zh-CN" : "en";
	const formatDate = (value: string) =>
		new Intl.DateTimeFormat(locale, {
			timeZone: "Asia/Singapore",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			hourCycle: "h23",
		}).format(new Date(value));

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-center gap-2">
				<TimeRangeSelector
					timeRange={query.period === "custom" ? undefined : query.period}
					onTimeRangeChange={(period) => {
						setCustomOpen(false);
						setRangeError(false);
						setQuery({ period });
					}}
				/>
				<Button
					variant={query.period === "custom" ? "primary" : "secondary"}
					size="sm"
					aria-pressed={customOpen}
					onClick={() => setCustomOpen((value) => !value)}
					className="gap-1.5"
				>
					<IconCalendar className="h-3.5 w-3.5" />
					{t("admin.stats_custom")}
				</Button>
				<span
					className="ml-auto text-xs text-muted"
					title={
						stats
							? `${formatDate(stats.start)} - ${formatDate(stats.end)}`
							: t("admin.stats_timezone")
					}
				>
					UTC+8
				</span>
				<Button
					variant="secondary"
					size="icon"
					title={`${t("admin.stats_refresh")}${stats ? ` · ${t("admin.stats_updated", { time: formatDate(stats.generated_at) })}` : ""}`}
					aria-label={t("admin.stats_refresh")}
					disabled={loading}
					onClick={() => setQuery((value) => ({ ...value }))}
				>
					<IconRefresh className="h-4 w-4" />
				</Button>
			</div>
			{customOpen && (
				<form
					className="flex flex-wrap items-end gap-3"
					onSubmit={(event) => {
						event.preventDefault();
						if (
							!customStart ||
							!customEnd ||
							customStart > customEnd ||
							customEnd > today ||
							(Date.parse(customEnd) - Date.parse(customStart)) / 86_400_000 + 1 > 90
						) {
							setRangeError(true);
							return;
						}
						setRangeError(false);
						setQuery({ period: "custom", start: customStart, end: customEnd });
					}}
				>
					<label className="space-y-1 text-xs text-muted">
						<span className="block">{t("admin.stats_start_date")}</span>
						<input
							type="date"
							required
							max={customEnd || today}
							value={customStart}
							onChange={(event) => setCustomStart(event.target.value)}
							className="block rounded-md border border-default bg-card px-3 py-2 text-sm text-light [color-scheme:light_dark]"
						/>
					</label>
					<label className="space-y-1 text-xs text-muted">
						<span className="block">{t("admin.stats_end_date")}</span>
						<input
							type="date"
							required
							min={customStart}
							max={today}
							value={customEnd}
							onChange={(event) => setCustomEnd(event.target.value)}
							className="block rounded-md border border-default bg-card px-3 py-2 text-sm text-light [color-scheme:light_dark]"
						/>
					</label>
					<Button
						type="submit"
						size="sm"
						variant="secondary"
						title={t("admin.stats_apply")}
						aria-label={t("admin.stats_apply")}
					>
						<IconCheck className="h-4 w-4" />
					</Button>
					{rangeError && (
						<p role="alert" className="text-xs text-error">
							{t("admin.stats_range_error")}
						</p>
					)}
				</form>
			)}
			{error && (
				<div
					role="alert"
					className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-error py-2 pl-3 text-sm text-error"
				>
					{t("admin.stats_load_error")}
					<Button variant="secondary" size="sm" onClick={() => setQuery((value) => ({ ...value }))}>
						{t("admin.stats_retry")}
					</Button>
				</div>
			)}
			<AdminStatsCards stats={stats} loading={loading} />
		</div>
	);
}
