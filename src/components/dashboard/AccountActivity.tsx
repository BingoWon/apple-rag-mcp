import { IconArrowUpRight } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { api } from "@/lib/api";
import type { CurrentUsage } from "@/types";
import { TOOL_KINDS, type ToolActivity, type UsagePeriod } from "../../../shared/tool-activity";
import TimeRangeSelector from "../charts/TimeRangeSelector";
import { TrendChart } from "../charts/TrendChart";
import { TOOL_COLORS } from "../charts/tool-series";

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
		<Card className="flex min-w-0 flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4">
			<div>
				<h2 className="text-sm font-medium text-muted">{t("activity.weekly_remaining")}</h2>
				<div className="mt-1 text-2xl font-semibold tabular-nums text-light">
					{data ? (data.limit === -1 ? t("activity.unlimited") : num(data.remaining)) : "—"}
					{data && data.limit >= 0 && (
						<span className="ml-2 text-sm font-normal text-muted">/ {num(data.limit)}</span>
					)}
				</div>
			</div>
			{data ? (
				<p className="text-xs text-muted">
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
				</p>
			) : error ? (
				<Button variant="secondary" size="sm" onClick={() => retry((v) => v + 1)}>
					{t("admin.stats_retry")}
				</Button>
			) : (
				<span className="text-xs text-muted">{t("admin.stats_loading")}</span>
			)}
		</Card>
	);
}

function ActivityPlot({ period }: { period: UsagePeriod }) {
	const { t, i18n } = useTranslation();
	const [data, set] = useState<ToolActivity | null>(null),
		[error, fail] = useState(false),
		[attempt, retry] = useState(0);
	useEffect(() => {
		const controller = new AbortController();
		fail(false);
		api
			.getUserToolCallsStats(period, controller.signal)
			.then((r) => {
				if (controller.signal.aborted) return;
				if (!r.success || !r.data) throw Error();
				set(r.data);
			})
			.catch(() => {
				if (!controller.signal.aborted) fail(true);
			});
		return () => controller.abort();
	}, [period, attempt]);
	if (!data)
		return (
			<div
				role="status"
				className="flex min-h-48 items-center justify-center gap-3 text-sm text-muted"
			>
				{t(error ? "admin.stats_unavailable" : "admin.stats_loading")}
				{error && (
					<Button size="sm" variant="secondary" onClick={() => retry((v) => v + 1)}>
						{t("admin.stats_retry")}
					</Button>
				)}
			</div>
		);
	const number = (v: number) => v.toLocaleString(i18n.resolvedLanguage);
	return (
		<>
			<div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
				<span className="text-3xl font-semibold tracking-tight tabular-nums text-light">
					{number(data.total)}
				</span>
				<span className="text-sm text-muted">{t("activity.recorded")}</span>
			</div>
			<div className="my-4 grid grid-cols-3 divide-x divide-default border-y border-default py-2">
				{TOOL_KINDS.map((k) => (
					<Link
						key={k}
						to={"/usage?" + new URLSearchParams({ tool: k, from: data.start, to: data.end })}
						className="group min-w-0 rounded-sm px-2 py-1.5 first:pl-0 sm:px-4 focus-visible:outline-2 focus-visible:outline-brand"
					>
						<span className="flex items-center gap-1.5 text-xs text-muted">
							<span
								aria-hidden
								className="size-2 shrink-0 rounded-full"
								style={{ background: TOOL_COLORS[k] }}
							/>
							{t("activity." + k)}
						</span>
						<span className="mt-1 flex items-center gap-1 text-lg font-semibold tabular-nums text-light group-hover:text-brand">
							{number(data.by_tool[k])}
							<IconArrowUpRight aria-hidden className="size-3.5 text-muted" />
						</span>
					</Link>
				))}
			</div>
			{data.total ? (
				<TrendChart
					metric={{ total: data.total, points: [] }}
					bucket={data.bucket}
					color={TOOL_COLORS.search}
					height={240}
					stackComparison
					comparison={TOOL_KINDS.map((k) => ({
						name: t("activity." + k),
						color: TOOL_COLORS[k],
						metric: { points: data.points.map((p) => ({ date: p.date, count: p[k] })) },
					}))}
				/>
			) : (
				<p className="py-10 text-center text-sm text-muted">{t("activity.empty")}</p>
			)}
		</>
	);
}

export function AccountActivity() {
	const { t } = useTranslation();
	const [period, setPeriod] = useState<UsagePeriod>("7d");
	return (
		<section className="min-w-0 space-y-4">
			<WeeklyQuota />
			<Card className="min-w-0 p-4 sm:p-6">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<h2 className="text-base font-semibold text-light">{t("activity.tool_calls")}</h2>
					<TimeRangeSelector timeRange={period} onTimeRangeChange={setPeriod} />
				</div>
				<ActivityPlot key={period} period={period} />
				<p className="mt-2 text-xs text-muted">{t("activity.window_note")}</p>
			</Card>
		</section>
	);
}
