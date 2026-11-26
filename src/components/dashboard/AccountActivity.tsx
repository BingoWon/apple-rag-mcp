import { IconActivity, IconArrowUpRight, IconCircleCheck } from "@tabler/icons-react";
import { type CSSProperties, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useTheme } from "@/components/providers/ThemeProvider";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { formatDateTimeWithZone } from "@/lib/datetime";
import type { CurrentUsage } from "@/types";
import { TOOL_KINDS, type ToolActivity, type UsagePeriod } from "../../../shared/tool-activity";
import TimeRangeSelector from "../charts/TimeRangeSelector";
import { CallsSparkline, OverviewChart, overviewPalette } from "./OverviewChart";

const TILE_BASE =
	"relative flex min-h-38 min-w-0 flex-col justify-between overflow-hidden rounded-lg border border-border bg-card px-5 pt-4 @max-[470px]:min-h-33 @max-[470px]:px-3 @max-[470px]:pt-3.5 @max-[315px]:min-h-28";
const TILE_LABEL =
	"flex items-start justify-between gap-1.5 text-lg font-semibold leading-snug @max-[470px]:text-sm";
const TILE_ICON = "size-6 shrink-0 text-subtle @max-[470px]:size-4";

function WeeklyQuota() {
	const { t, i18n } = useTranslation();
	const [data, setData] = useState<CurrentUsage | null>(null);
	const [error, setError] = useState(false);

	const loadQuota = useCallback((signal?: AbortSignal) => {
		setError(false);
		api
			.getUserQuota(signal)
			.then((r) => {
				if (signal?.aborted) return;
				if (!r.success || !r.data) throw Error();
				setData(r.data);
			})
			.catch(() => {
				if (!signal?.aborted) setError(true);
			});
	}, []);

	useEffect(() => {
		const controller = new AbortController();
		loadQuota(controller.signal);
		return () => controller.abort();
	}, [loadQuota]);

	const num = (v: number) => v.toLocaleString(i18n.resolvedLanguage);
	return (
		<div className={`${TILE_BASE} activity-tile-quota shadow-[0_3px_10px_rgb(32_38_46/7%)]`}>
			<div>
				<h3 className={TILE_LABEL}>
					{t("activity.weekly_remaining")}
					<IconCircleCheck aria-hidden className={TILE_ICON} />
				</h3>
				<p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-3xl font-bold tabular-nums text-foreground">
					{data ? (data.limit === -1 ? t("activity.unlimited") : num(data.remaining)) : "—"}
					{data && data.limit >= 0 && (
						<span className="whitespace-nowrap text-sm font-medium text-muted">
							/ {num(data.limit)}
						</span>
					)}
				</p>
			</div>
			<div className="pt-2 pb-3.5 text-[0.72rem] leading-snug">
				{data ? (
					<>
						{data.limit > 0 && (
							<div
								className="mb-1.5 h-1 overflow-hidden rounded-full bg-subtle/20"
								aria-hidden="true"
							>
								<span
									className="block h-full rounded-full bg-subtle"
									style={{
										width: `${Math.max(0, Math.min(100, (100 * data.remaining) / data.limit))}%`,
									}}
								/>
							</div>
						)}
						<span className="text-muted">
							{t("activity.resets", {
								date: formatDateTimeWithZone(data.reset_at, i18n.resolvedLanguage),
							})}
						</span>
					</>
				) : error ? (
					<Button variant="secondary" size="sm" onClick={() => loadQuota()}>
						{t("admin.stats_retry")}
					</Button>
				) : (
					<span className="text-muted">{t("admin.stats_loading")}</span>
				)}
			</div>
		</div>
	);
}

export function AccountActivity() {
	const { t, i18n } = useTranslation();
	const { resolvedTheme } = useTheme();
	const colors = overviewPalette(resolvedTheme === "dark");
	const [period, setPeriod] = useState<UsagePeriod>("7d");
	const [response, setResponse] = useState<{
		period: UsagePeriod;
		data: ToolActivity | null;
	} | null>(null);
	const data = response?.period === period ? response.data : null;
	const failed = response?.period === period && response.data === null;

	const loadActivity = useCallback((targetPeriod: UsagePeriod, signal?: AbortSignal) => {
		api
			.getUserToolCallsStats(targetPeriod, signal)
			.then((r) => {
				if (signal?.aborted) return;
				if (!r.success || !r.data) throw Error();
				setResponse({ period: targetPeriod, data: r.data });
			})
			.catch(() => {
				if (!signal?.aborted) setResponse({ period: targetPeriod, data: null });
			});
	}, []);

	useEffect(() => {
		const controller = new AbortController();
		loadActivity(period, controller.signal);
		return () => controller.abort();
	}, [period, loadActivity]);

	const number = (v: number) => v.toLocaleString(i18n.resolvedLanguage);
	return (
		<Card
			className="@container"
			style={
				{
					"--overview-search": colors.search,
					"--overview-fetch": colors.fetch,
					"--overview-browse": colors.browse,
				} as CSSProperties
			}
		>
			<CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
				<CardTitle>{t("chart.usage_trends")}</CardTitle>
				<TimeRangeSelector
					timeRange={period}
					presentation="overview"
					onTimeRangeChange={setPeriod}
				/>
			</CardHeader>
			<CardContent className="space-y-4 px-4 pb-5 sm:px-6">
				<div className="grid grid-cols-2 gap-6 @max-[470px]:gap-2.5 @max-[315px]:grid-cols-1">
					<div className={`${TILE_BASE} activity-tile-calls shadow-[0_4px_12px_rgb(35_48_68/8%)]`}>
						<div>
							<h3 className={TILE_LABEL}>
								{t("activity.total_calls")}
								<IconActivity aria-hidden className={TILE_ICON} />
							</h3>
							<p className="mt-1 text-3xl font-bold tabular-nums text-foreground">
								{data ? number(data.total) : "—"}
							</p>
						</div>
						<div className="-mx-5 h-13.5 @max-[470px]:-mx-3">
							{data && <CallsSparkline data={data} />}
						</div>
					</div>
					<WeeklyQuota />
				</div>
				{data ? (
					<>
						<div className="flex flex-wrap items-center gap-x-4 gap-y-1">
							{TOOL_KINDS.map((k) => (
								<Link
									key={k}
									to={`/usage?${new URLSearchParams({ tool: k, from: data.start, to: data.end })}`}
									className="inline-flex min-h-8 items-center gap-1.5 rounded text-xs text-muted hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
									aria-label={t("activity.open_logs", { tool: t(`activity.${k}`) })}
								>
									<span
										className="size-2 rounded-full"
										aria-hidden
										style={{ background: colors[k] }}
									/>
									{t(`activity.${k}`)}{" "}
									<strong className="font-semibold tabular-nums text-foreground">
										{number(data.by_tool[k])}
									</strong>
									<IconArrowUpRight aria-hidden className="size-3" />
								</Link>
							))}
						</div>
						{data.total ? (
							<OverviewChart data={data} colors={colors} />
						) : (
							<p className="py-10 text-center text-sm text-muted">{t("activity.empty")}</p>
						)}
					</>
				) : (
					<div
						role="status"
						className="flex min-h-32 items-center justify-center gap-3 text-sm text-muted"
					>
						{t(failed ? "admin.stats_unavailable" : "admin.stats_loading")}
						{failed && (
							<Button
								size="sm"
								variant="secondary"
								onClick={() => {
									setResponse(null);
									loadActivity(period);
								}}
							>
								{t("admin.stats_retry")}
							</Button>
						)}
					</div>
				)}
				<p className="text-xs text-muted">{t("activity.window_note")}</p>
			</CardContent>
		</Card>
	);
}
