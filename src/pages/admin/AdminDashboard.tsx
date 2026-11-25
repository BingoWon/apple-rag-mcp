import { IconCalendar, IconCheck, IconRefresh } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminStatsCards } from "@/components/admin/AdminStatsCards";
import TimeRangeSelector from "@/components/charts/TimeRangeSelector";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import type { AdminDashboardStats, AdminStatsQuery } from "@/types";

const REFRESH_INTERVAL = 5 * 60_000;

export default function AdminDashboard() {
	const { t, i18n } = useTranslation();
	const [query, setQuery] = useState<AdminStatsQuery>({ period: "7d" });
	const [snapshot, setSnapshot] = useState<{ query: AdminStatsQuery; data: AdminDashboardStats }>();
	const stats = snapshot?.query === query ? snapshot.data : null;
	const refresh = useRef<() => void>(() => {});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);
	const [customOpen, setCustomOpen] = useState(false);
	const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(Date.now());
	const [customStart, setCustomStart] = useState(today);
	const [customEnd, setCustomEnd] = useState(today);
	const [rangeError, setRangeError] = useState(false);

	useEffect(() => {
		const controller = new AbortController();
		let timer: number;
		let nextRefresh = 0;
		let inFlight = false;
		setLoading(true);
		setError(false);
		const load = async () => {
			if (inFlight || controller.signal.aborted) return;
			inFlight = true;
			window.clearTimeout(timer);
			setLoading(true);
			try {
				const response = await api.getAdminStats(query, controller.signal);
				if (!response.success || !response.data) throw new Error("Statistics unavailable");
				if (!controller.signal.aborted) {
					setSnapshot({ query, data: response.data });
					setError(false);
				}
			} catch {
				if (!controller.signal.aborted) setError(true);
			} finally {
				inFlight = false;
				if (!controller.signal.aborted) {
					setLoading(false);
					nextRefresh = Date.now() + REFRESH_INTERVAL;
					timer = window.setTimeout(check, REFRESH_INTERVAL);
				}
			}
		};
		const check = () => {
			if (!document.hidden && Date.now() >= nextRefresh) void load();
		};
		refresh.current = load;
		check();
		document.addEventListener("visibilitychange", check);
		window.addEventListener("focus", check);
		return () => {
			controller.abort();
			window.clearTimeout(timer);
			document.removeEventListener("visibilitychange", check);
			window.removeEventListener("focus", check);
		};
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
		<div className="mx-auto max-w-[1440px] space-y-6">
			<div className="flex flex-wrap items-center gap-2">
				<TimeRangeSelector
					timeRange={query.period === "custom" ? undefined : query.period}
					onTimeRangeChange={(period) => {
						setCustomOpen(false);
						setRangeError(false);
						setQuery((value) => ({ period, channel: value.channel }));
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
					{stats && <>{t("admin.stats_updated", { time: formatDate(stats.generated_at) })} · </>}
					UTC+8
				</span>
				<Button
					variant="secondary"
					size="icon"
					title={t("admin.stats_refresh")}
					aria-label={t("admin.stats_refresh")}
					disabled={loading}
					onClick={() => refresh.current()}
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
						setQuery((value) => ({
							period: "custom",
							start: customStart,
							end: customEnd,
							channel: value.channel,
						}));
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
							className="block rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground [color-scheme:light_dark]"
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
							className="block rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground [color-scheme:light_dark]"
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
						<p role="alert" className="text-xs text-destructive">
							{t("admin.stats_range_error")}
						</p>
					)}
				</form>
			)}
			{error && (
				<div
					role="alert"
					className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-destructive py-2 pl-3 text-sm text-destructive"
				>
					{t("admin.stats_load_error")}
					<Button variant="secondary" size="sm" onClick={() => refresh.current()}>
						{t("admin.stats_retry")}
					</Button>
				</div>
			)}
			<AdminStatsCards
				stats={stats}
				loading={loading}
				query={query}
				onChannelChange={(channel) => setQuery((value) => ({ ...value, channel }))}
			/>
		</div>
	);
}
