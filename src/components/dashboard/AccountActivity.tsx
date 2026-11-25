import { IconActivity, IconArrowUpRight, IconCircleCheck } from "@tabler/icons-react";
import { type CSSProperties, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useTheme } from "@/components/providers/ThemeProvider";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { api } from "@/lib/api";
import type { CurrentUsage } from "@/types";
import { TOOL_KINDS, type ToolActivity, type UsagePeriod } from "../../../shared/tool-activity";
import TimeRangeSelector from "../charts/TimeRangeSelector";
import style from "./AccountActivity.module.css";
import { CallsSparkline, OverviewChart, overviewPalette } from "./OverviewChart";

function WeeklyQuota() {
	const { t, i18n } = useTranslation();
	const [data, set] = useState<CurrentUsage | null>(null),
		[error, fail] = useState(false),
		[attempt, retry] = useState(0);
	useEffect(() => {
		const controller = new AbortController();
		fail(false);
		api
			.getUserQuota(controller.signal)
			.then((r) => {
				if (controller.signal.aborted) return;
				if (!r.success || !r.data) throw Error();
				set(r.data);
			})
			.catch(() => {
				if (!controller.signal.aborted) fail(true);
			});
		return () => controller.abort();
	}, [attempt]);
	const num = (v: number) => v.toLocaleString(i18n.resolvedLanguage);
	return (
		<div className={style.tile + " " + style.quota}>
			<div>
				<h3 className={style.label}>
					{t("activity.weekly_remaining")}
					<IconCircleCheck aria-hidden className="text-subtle" />
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
			<div className={style.quotaFoot}>
				{data ? (
					<>
						{data.limit > 0 && (
							<div className={style.rail} aria-hidden="true">
								<span
									style={{
										width: Math.max(0, Math.min(100, (100 * data.remaining) / data.limit)) + "%",
									}}
								/>
							</div>
						)}
						<span className="text-muted">
							{t("activity.resets", {
								date: new Intl.DateTimeFormat(i18n.resolvedLanguage, {
									month: "short",
									day: "numeric",
									hour: "2-digit",
									minute: "2-digit",
									hourCycle: "h23",
									timeZone: "Asia/Singapore",
								}).format(Date.parse(data.reset_at)),
							})}
						</span>
					</>
				) : error ? (
					<Button variant="secondary" size="sm" onClick={() => retry((v) => v + 1)}>
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
	const [attempt, retry] = useState(0);
	const data = response?.period === period ? response.data : null;
	const failed = response?.period === period && response.data === null;
	useEffect(() => {
		const controller = new AbortController();

		api
			.getUserToolCallsStats(period, controller.signal)
			.then((r) => {
				if (controller.signal.aborted) return;
				if (!r.success || !r.data) throw Error();
				setResponse({ period, data: r.data });
			})
			.catch(() => {
				if (!controller.signal.aborted) setResponse({ period, data: null });
			});
		return () => controller.abort();
	}, [period, attempt]);
	const number = (v: number) => v.toLocaleString(i18n.resolvedLanguage);
	return (
		<Card
			className={style.panel}
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
				<div className={style.summary}>
					<div className={style.tile + " " + style.calls}>
						<div>
							<h3 className={style.label}>
								{t("activity.total_calls")}
								<IconActivity aria-hidden className="text-subtle" />
							</h3>
							<p className="mt-1 text-3xl font-bold tabular-nums text-foreground">
								{data ? number(data.total) : "—"}
							</p>
						</div>
						<div className={style.spark}>
							{data && <CallsSparkline data={data} colors={colors} />}
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
									to={"/usage?" + new URLSearchParams({ tool: k, from: data.start, to: data.end })}
									className="inline-flex min-h-8 items-center gap-1.5 rounded text-xs text-muted hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
									aria-label={t("activity.open_logs", { tool: t("activity." + k) })}
								>
									<span
										className="size-2 rounded-full"
										aria-hidden
										style={{ background: colors[k] }}
									/>
									{t("activity." + k)}{" "}
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
									retry((v) => v + 1);
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
