import {
	IconArrowRight,
	IconCircleCheck,
	IconDatabase,
	IconFileText,
	IconVideo,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { CorpusStats } from "@/types";
import type { UpdatesSummaryResponse } from "../../../shared/doc-updates";

const metrics = [
	{
		field: "docs_total",
		label: "stats_doc_pages",
		icon: IconFileText,
		color: "#9595ff",
		url: "https://developer.apple.com/documentation",
	},
	{
		field: "videos_total",
		label: "stats_wwdc_videos",
		icon: IconVideo,
		color: "#fca147",
		url: "https://developer.apple.com/videos/",
	},
	{
		field: "chunks_total",
		label: "stats_chunks",
		icon: IconDatabase,
		color: "#42c16e",
		url: undefined,
	},
	{
		field: "embedded_percentage",
		label: "stats_embedded",
		icon: IconCircleCheck,
		color: "#dc5bb7",
		url: undefined,
	},
] as const;

export default function StatsCards() {
	const { t, i18n } = useTranslation();
	const [data, setData] = useState<CorpusStats | null>();
	const [pulse, setPulse] = useState<UpdatesSummaryResponse | null>(null);
	useEffect(() => {
		if (data !== undefined) return;
		const controller = new AbortController();
		api
			.getCorpusStats(controller.signal)
			.then(({ success, data }) => {
				if (controller.signal.aborted) return;
				if (
					!success ||
					!data ||
					!Number.isFinite(Date.parse(data.generated_at)) ||
					metrics.some(
						({ field }) =>
							!(field === "embedded_percentage" && data[field] === null) &&
							!Number.isFinite(data[field]),
					)
				)
					throw Error();
				setData(data);
			})
			.catch(() => {
				if (!controller.signal.aborted) setData(null);
			});
		api
			.getUpdatesSummary(controller.signal)
			.then(({ success, data }) => {
				if (!controller.signal.aborted && success && data) setPulse(data);
			})
			.catch(() => {});
		return () => controller.abort();
	}, [data]);
	const locale = i18n.resolvedLanguage ?? "en";
	const isZh = locale.startsWith("zh");
	const activeDigest = pulse?.latest_daily ?? pulse?.latest_weekly ?? null;
	const digestHeadline = activeDigest
		? isZh
			? activeDigest.content_zh.headline
			: activeDigest.content_en.headline
		: null;
	const lastRunLabel = (() => {
		const iso = pulse?.heartbeat.last_run_at;
		if (!iso) return null;
		const diffMin = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60_000));
		const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
		return diffMin < 60
			? rtf.format(-diffMin, "minute")
			: rtf.format(-Math.round(diffMin / 60), "hour");
	})();
	return (
		<Card className="mb-6 @container">
			<CardContent className="p-6">
				{data && (
					<div className="flex justify-center mb-5">
						<div className="flex max-w-full items-center gap-2 rounded-full bg-brand px-1.5 py-1">
							<div className="w-fit shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-brand sm:text-sm text-center flex items-center gap-1">
								<IconCircleCheck aria-hidden="true" className="w-4 h-4" />
								<span className="hidden sm:inline">{t("common.status")}</span>
							</div>
							<p className="min-w-0 pr-2 text-xs font-semibold text-white @[450px]:text-sm @[450px]:whitespace-nowrap">
								{t("dashboard.stats_freshness")}
							</p>
						</div>
					</div>
				)}
				<div className="mb-5 text-center">
					<h3 className="text-xl font-bold text-light">{t("dashboard.stats_heading")}</h3>
					{data && (
						<p className="mt-1 text-xs text-muted">
							{t("dashboard.stats_date", {
								date: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
									Date.parse(data.generated_at),
								),
							})}
						</p>
					)}
				</div>
				{data ? (
					<div className="grid grid-cols-2 gap-3 @[450px]:grid-cols-4 @[450px]:gap-4">
						{metrics.map(({ field, label, icon: Icon, color, url }) => {
							const Tile = url ? "a" : "div";
							return (
								<Tile
									key={field}
									href={url}
									target={url ? "_blank" : undefined}
									rel={url ? "noopener noreferrer" : undefined}
									title={
										field === "embedded_percentage"
											? t("dashboard.stats_coverage_detail", {
													indexed: data.indexed_pages,
													readable: data.readable_pages,
													navigation: data.navigation_only_pages,
												})
											: undefined
									}
									className={cn(
										"group flex h-24 min-w-0 flex-col items-center justify-center gap-1 rounded-[10px] text-center focus-visible:outline-2 focus-visible:outline-action @[450px]:h-32 @[450px]:gap-2",
										url &&
											"motion-safe:transition-transform motion-safe:duration-[350ms] motion-safe:hover:scale-110",
									)}
									style={{ backgroundColor: `${color}20`, color }}
								>
									<Icon aria-hidden="true" className="size-6 lg:size-8" />
									<strong className="text-lg font-semibold tabular-nums @[450px]:text-xl">
										{data[field] === null
											? "—"
											: new Intl.NumberFormat(
													locale,
													field === "embedded_percentage"
														? { style: "percent", maximumFractionDigits: 1 }
														: {},
												).format(field === "embedded_percentage" ? data[field] / 100 : data[field])}
									</strong>
									<span
										className={cn(
											"text-xs font-semibold @[450px]:text-sm",
											url && "underline-offset-2 group-hover:underline",
										)}
									>
										{t(`dashboard.${label}`)}
									</span>
								</Tile>
							);
						})}
					</div>
				) : data === null ? (
					<div role="alert" className="space-y-3 text-center text-sm text-muted">
						<p>{t("admin.stats_load_error")}</p>
						<Button variant="secondary" size="sm" onClick={() => setData(undefined)}>
							{t("admin.stats_retry")}
						</Button>
					</div>
				) : (
					<p role="status" className="text-center text-sm text-muted">
						{t("admin.stats_loading")}
					</p>
				)}

				{data && (
					<div className="mt-5 rounded-xl border border-default bg-secondary p-3.5">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<div className="flex items-center gap-2 text-xs text-muted-foreground">
								<span className="h-2 w-2 shrink-0 rounded-full bg-success" aria-hidden="true" />
								<span>
									{pulse && lastRunLabel
										? t("dashboard.stats_pulse_meta", {
												time: lastRunLabel,
												scanned: new Intl.NumberFormat(locale).format(pulse.heartbeat.scanned_24h),
												changed: new Intl.NumberFormat(locale).format(pulse.heartbeat.changed_24h),
											})
										: t("dashboard.stats_pulse_default")}
								</span>
							</div>
							<Link
								to="/updates"
								className="inline-flex items-center gap-1 text-xs font-semibold text-action hover:underline"
							>
								<span>{t("dashboard.stats_pulse_link")}</span>
								<IconArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
							</Link>
						</div>

						{digestHeadline && (
							<p className="mt-2 line-clamp-1 text-xs font-medium text-light sm:text-sm">
								{digestHeadline}
							</p>
						)}

						{pulse && pulse.top_frameworks_7d.length > 0 && (
							<div className="mt-2.5 flex flex-wrap items-center gap-1.5">
								{pulse.top_frameworks_7d.slice(0, 3).map((fw) => (
									<Link
										key={fw.framework}
										to={`/updates?framework=${encodeURIComponent(fw.framework)}`}
										className="inline-flex items-center gap-1 rounded-md border border-default bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:border-brand/50 hover:text-light"
									>
										<span>{fw.framework}</span>
										<span className="font-mono text-brand">{fw.count}</span>
									</Link>
								))}
							</div>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
