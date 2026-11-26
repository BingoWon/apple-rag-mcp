import {
	IconArrowRight,
	IconBraces,
	IconClock,
	IconRss,
	IconSearch,
	IconX,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/Button";
import { AppNavbar } from "@/components/ui/resizable-navbar";
import { ChangeEventCard } from "@/components/updates/ChangeEventCard";
import { DigestPanel } from "@/components/updates/DigestPanel";
import { UpdatesSelect } from "@/components/updates/UpdatesSelect";
import { usePageScroll } from "@/hooks/usePageScroll";
import { api } from "@/lib/api";
import type { CorpusStats } from "@/types";
import { parseUTCDate } from "../../shared/datetime";
import {
	type DigestPeriodType,
	DOC_CHANGE_KINDS,
	type DocChangeDigest,
	type DocChangeEventItem,
	type DocChangeKind,
	type UpdatesSummaryResponse,
} from "../../shared/doc-updates";

const KIND_SEGMENT_COLOR: Record<DocChangeKind, string> = {
	added: "bg-success",
	content_revised: "bg-brand-strong dark:bg-brand",
	deprecated: "bg-destructive",
	removed: "bg-destructive/70",
	beta_changed: "bg-warning",
	signature_changed: "bg-sky-500",
	video_added: "bg-indigo-400",
};

function parseDigestParam(raw: string | null): { period: DigestPeriodType; key: string } | null {
	if (!raw) return null;
	const [period, key] = raw.split(":");
	if ((period === "daily" || period === "weekly") && key) {
		return { period, key };
	}
	return null;
}

function formatRelativeMinutes(iso: string | null, locale: string): string {
	const parsed = iso ? parseUTCDate(iso) : null;
	if (!parsed) return "—";
	const diffSec = Math.max(0, Math.round((Date.now() - parsed.getTime()) / 1000));
	const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
	if (diffSec < 60) return rtf.format(-diffSec, "second");
	const diffMin = Math.round(diffSec / 60);
	if (diffMin < 60) return rtf.format(-diffMin, "minute");
	const diffHours = Math.round(diffMin / 60);
	if (diffHours < 24) return rtf.format(-diffHours, "hour");
	return rtf.format(-Math.round(diffHours / 24), "day");
}

export default function UpdatesPage() {
	const { t, i18n } = useTranslation();
	usePageScroll();
	const [searchParams, setSearchParams] = useSearchParams();
	const locale = i18n.resolvedLanguage ?? "en";

	const initialDigest = parseDigestParam(searchParams.get("digest"));
	const [summary, setSummary] = useState<UpdatesSummaryResponse | null>(null);
	const [corpus, setCorpus] = useState<CorpusStats | null>(null);
	const [digestPeriod, setDigestPeriod] = useState<DigestPeriodType>(
		initialDigest?.period ?? "daily",
	);
	const [digestsByPeriod, setDigestsByPeriod] = useState<
		Record<DigestPeriodType, DocChangeDigest[]>
	>({ daily: [], weekly: [] });
	const [selectedKeyByPeriod, setSelectedKeyByPeriod] = useState<
		Record<DigestPeriodType, string | null>
	>({
		daily: initialDigest?.period === "daily" ? initialDigest.key : null,
		weekly: initialDigest?.period === "weekly" ? initialDigest.key : null,
	});
	const [loadedPeriods, setLoadedPeriods] = useState<Record<DigestPeriodType, boolean>>({
		daily: false,
		weekly: false,
	});
	const [digestError, setDigestError] = useState<Record<DigestPeriodType, boolean>>({
		daily: false,
		weekly: false,
	});
	const [summaryAttempt, setSummaryAttempt] = useState(0);

	const [radarRange, setRadarRange] = useState<"7d" | "30d">("7d");
	const [framework, setFramework] = useState<string>(searchParams.get("framework") ?? "");
	const [kind, setKind] = useState<string>(searchParams.get("kind") ?? "");
	const [significance, setSignificance] = useState<"important" | "all">("important");
	const [days, setDays] = useState<number>(30);
	const [searchInput, setSearchInput] = useState("");
	const [query, setQuery] = useState("");

	const [events, setEvents] = useState<DocChangeEventItem[]>([]);
	const [totalEvents, setTotalEvents] = useState(0);
	const [hasMore, setHasMore] = useState(false);
	const [feedLoading, setFeedLoading] = useState(true);
	const [feedError, setFeedError] = useState(false);
	const [feedAttempt, setFeedAttempt] = useState(0);
	const [loadingMore, setLoadingMore] = useState(false);

	// Load summary, corpus stats, and both daily & weekly digest histories in parallel
	useEffect(() => {
		void summaryAttempt;
		const controller = new AbortController();

		api
			.getUpdatesSummary(controller.signal)
			.then((res) => {
				if (controller.signal.aborted || !res.success || !res.data) return;
				const sum = res.data;
				setSummary(sum);
				setDigestsByPeriod((prev) => ({
					daily: prev.daily.length || !sum.latest_daily ? prev.daily : [sum.latest_daily],
					weekly: prev.weekly.length || !sum.latest_weekly ? prev.weekly : [sum.latest_weekly],
				}));
				setSelectedKeyByPeriod((prev) => ({
					daily: prev.daily ?? sum.latest_daily?.period_key ?? null,
					weekly: prev.weekly ?? sum.latest_weekly?.period_key ?? null,
				}));
			})
			.catch(() => {});

		api
			.getCorpusStats(controller.signal)
			.then((res) => {
				if (!controller.signal.aborted && res.success && res.data) setCorpus(res.data);
			})
			.catch(() => {});

		for (const period of ["daily", "weekly"] as const) {
			setDigestError((prev) => ({ ...prev, [period]: false }));
			api
				.getUpdatesDigests(period, 14, controller.signal)
				.then((res) => {
					if (controller.signal.aborted) return;
					if (!res.success || !res.data) {
						setDigestError((prev) => ({ ...prev, [period]: true }));
						return;
					}
					const list = res.data.digests;
					setDigestsByPeriod((prev) => ({ ...prev, [period]: list }));
					setSelectedKeyByPeriod((prev) => ({
						...prev,
						[period]: prev[period] ?? list[0]?.period_key ?? null,
					}));
				})
				.catch(() => {
					if (!controller.signal.aborted) {
						setDigestError((prev) => ({ ...prev, [period]: true }));
					}
				})
				.finally(() => {
					if (!controller.signal.aborted) {
						setLoadedPeriods((prev) => ({ ...prev, [period]: true }));
					}
				});
		}

		return () => controller.abort();
	}, [summaryAttempt]);

	// Debounce search input
	useEffect(() => {
		const id = window.setTimeout(() => setQuery(searchInput.trim()), 250);
		return () => window.clearTimeout(id);
	}, [searchInput]);

	const applyFrameworkFilter = useCallback(
		(nextFramework: string) => {
			const resolved = framework === nextFramework ? "" : nextFramework;
			setFramework(resolved);
			const next = new URLSearchParams(searchParams);
			if (resolved) next.set("framework", resolved);
			else next.delete("framework");
			setSearchParams(next, { replace: true });
		},
		[framework, searchParams, setSearchParams],
	);

	const applyKindFilter = useCallback(
		(nextKind: string) => {
			const resolved = kind === nextKind ? "" : nextKind;
			setKind(resolved);
			const next = new URLSearchParams(searchParams);
			if (resolved) next.set("kind", resolved);
			else next.delete("kind");
			setSearchParams(next, { replace: true });
		},
		[kind, searchParams, setSearchParams],
	);

	const clearAllFilters = useCallback(() => {
		setFramework("");
		setKind("");
		setSearchInput("");
		setQuery("");
		const next = new URLSearchParams(searchParams);
		next.delete("framework");
		next.delete("kind");
		setSearchParams(next, { replace: true });
	}, [searchParams, setSearchParams]);

	// Load event feed
	useEffect(() => {
		void feedAttempt;
		const controller = new AbortController();
		setFeedLoading(true);
		setFeedError(false);
		api
			.getUpdatesFeed(
				{
					framework: framework || undefined,
					kind: kind || undefined,
					significance,
					days,
					q: query || undefined,
					limit: 25,
					offset: 0,
				},
				controller.signal,
			)
			.then((res) => {
				if (controller.signal.aborted) return;
				if (res.success && res.data) {
					setEvents(res.data.events);
					setTotalEvents(res.data.total);
					setHasMore(res.data.has_more);
				} else {
					setFeedError(true);
				}
			})
			.catch(() => {
				if (!controller.signal.aborted) {
					setFeedError(true);
					setEvents([]);
					setTotalEvents(0);
					setHasMore(false);
				}
			})
			.finally(() => {
				if (!controller.signal.aborted) setFeedLoading(false);
			});
		return () => controller.abort();
	}, [framework, kind, significance, days, query, feedAttempt]);

	const handleLoadMore = async () => {
		if (loadingMore || !hasMore) return;
		setLoadingMore(true);
		try {
			const res = await api.getUpdatesFeed({
				framework: framework || undefined,
				kind: kind || undefined,
				significance,
				days,
				q: query || undefined,
				limit: 25,
				offset: events.length,
			});
			if (res.success && res.data) {
				const incoming = res.data.events;
				setEvents((prev) => {
					const seen = new Set(prev.map((item) => item.id));
					return [...prev, ...incoming.filter((item) => !seen.has(item.id))];
				});
				setTotalEvents(res.data.total);
				setHasMore(res.data.has_more);
			}
		} catch {
			// Keep existing loaded events intact on transient pagination error
		} finally {
			setLoadingMore(false);
		}
	};

	const topFrameworks =
		radarRange === "7d" ? (summary?.top_frameworks_7d ?? []) : (summary?.top_frameworks_30d ?? []);
	const byKind = radarRange === "7d" ? (summary?.by_kind_7d ?? {}) : (summary?.by_kind_30d ?? {});
	const maxFwCount = Math.max(1, ...topFrameworks.map((f) => f.count));
	const fmtNum = (n: number) => new Intl.NumberFormat(locale).format(n);

	const kindBreakdown = useMemo(() => {
		const entries = DOC_CHANGE_KINDS.map((k) => ({ kind: k, count: byKind[k] ?? 0 }));
		const total = entries.reduce((sum, item) => sum + item.count, 0);
		return {
			total,
			sorted: [...entries].sort((a, b) => b.count - a.count),
		};
	}, [byKind]);

	const rangeOptions = useMemo(
		() => [
			{ value: "1", label: t("updates.range_1d") },
			{ value: "7", label: t("updates.range_7d") },
			{ value: "30", label: t("updates.range_30d") },
			{ value: "90", label: t("updates.range_90d") },
		],
		[t],
	);

	return (
		<div className="min-h-screen bg-background text-foreground">
			<AppNavbar />
			<main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8 sm:px-6 sm:pt-10 lg:px-8">
				{/* Editorial Masthead */}
				<header className="flex flex-wrap items-end justify-between gap-4">
					<div className="max-w-2xl">
						<div className="flex flex-col gap-y-0.5 text-xs font-medium text-subtle sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2">
							<span className="inline-flex items-center gap-1.5 text-foreground/80">
								<span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
								<span>{t("updates.eyebrow")}</span>
							</span>
							{summary?.heartbeat.last_run_at && (
								<>
									<span className="hidden text-border-strong sm:inline" aria-hidden="true">
										·
									</span>
									<span className="tabular-nums">
										{t("updates.metric_last_run")}:{" "}
										{formatRelativeMinutes(summary.heartbeat.last_run_at, locale)}
									</span>
								</>
							)}
						</div>

						<h1 className="mt-2.5 text-3xl font-semibold tracking-[-0.025em] text-foreground sm:text-4xl">
							{t("updates.title")}
						</h1>
						<p className="mt-2.5 text-sm leading-relaxed text-muted sm:text-[15px]">
							{t("updates.subtitle")}
						</p>
					</div>

					<div className="flex items-center gap-2">
						<a
							href="/api/updates/rss.xml"
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium leading-none text-muted transition-colors duration-150 hover:border-border-strong hover:bg-surface hover:text-foreground"
						>
							<IconRss className="h-3.5 w-3.5 text-subtle" aria-hidden="true" />
							<span>RSS</span>
						</a>
						<a
							href="/api/updates/feed.json"
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium leading-none text-muted transition-colors duration-150 hover:border-border-strong hover:bg-surface hover:text-foreground"
						>
							<IconBraces className="h-3.5 w-3.5 text-subtle" aria-hidden="true" />
							<span>JSON Feed</span>
						</a>
					</div>
				</header>

				{/* Unified Architectural Telemetry Strip (1 container, hairline dividers) */}
				<section
					aria-label={t("updates.heartbeat_aria")}
					className="mt-7 grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-surface/50 lg:grid-cols-4"
				>
					<div className="border-b border-r border-border px-4 py-4 sm:px-5 lg:border-b-0">
						<p className="text-xs text-subtle">{t("updates.metric_last_run")}</p>
						<p className="mt-2 text-xl font-medium tracking-tight tabular-nums text-foreground sm:text-2xl">
							{formatRelativeMinutes(summary?.heartbeat.last_run_at ?? null, locale)}
						</p>
						<p className="mt-1 text-xs text-subtle">
							{summary?.heartbeat.last_sweep_source
								? t(`updates.source_${summary.heartbeat.last_sweep_source}`)
								: t("updates.cadence_label")}
						</p>
					</div>

					<div className="border-b border-border px-4 py-4 sm:px-5 lg:border-b-0 lg:border-r">
						<p className="text-xs text-subtle">{t("updates.metric_scanned_24h")}</p>
						<p className="mt-2 text-xl font-medium tracking-tight tabular-nums text-foreground sm:text-2xl">
							{summary ? fmtNum(summary.heartbeat.scanned_24h) : "—"}
						</p>
						<p className="mt-1 text-xs tabular-nums text-subtle">
							{summary
								? t("updates.metric_not_modified", {
										count: fmtNum(summary.heartbeat.not_modified_24h),
									})
								: "\u00A0"}
						</p>
					</div>

					<div className="border-r border-border px-4 py-4 sm:px-5">
						<p className="text-xs text-subtle">{t("updates.metric_changes")}</p>
						<p className="mt-2 text-xl font-medium tracking-tight tabular-nums text-foreground sm:text-2xl">
							{summary ? fmtNum(summary.heartbeat.changed_24h) : "—"}
						</p>
						<p className="mt-1 text-xs tabular-nums text-subtle">
							{summary
								? `${t("updates.range_7d")}: ${fmtNum(summary.heartbeat.changed_7d)}`
								: t("updates.metric_changes_hint")}
						</p>
					</div>

					<div className="px-4 py-4 sm:px-5">
						<p className="text-xs text-subtle">{t("updates.metric_coverage")}</p>
						<p className="mt-2 text-xl font-medium tracking-tight tabular-nums text-foreground sm:text-2xl">
							{corpus?.embedded_percentage != null ? `${corpus.embedded_percentage}%` : "—"}
						</p>
						<p className="mt-1 text-xs tabular-nums text-subtle">
							{corpus
								? t("updates.metric_docs_total", { count: fmtNum(corpus.docs_total) })
								: "\u00A0"}
						</p>
					</div>
				</section>

				{/* Editorial Trend Digest + Interactive Pulse Strip (flat, zero wrapper div) */}
				<DigestPanel
					className="mt-6"
					period={digestPeriod}
					onPeriodChange={setDigestPeriod}
					digests={digestsByPeriod[digestPeriod]}
					selectedKey={selectedKeyByPeriod[digestPeriod]}
					onSelectKey={(key) =>
						setSelectedKeyByPeriod((prev) => ({ ...prev, [digestPeriod]: key }))
					}
					loading={!loadedPeriods[digestPeriod] && digestsByPeriod[digestPeriod].length === 0}
					error={digestError[digestPeriod]}
					onRetry={() => setSummaryAttempt((v) => v + 1)}
					onFilterFramework={applyFrameworkFilter}
				/>

				{/* Unified Framework & Change-Type Split Panel (balanced density, zero dead space) */}
				<section className="mt-6 grid grid-cols-1 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-12 lg:divide-x lg:divide-y-0">
					<div className="p-5 sm:p-6 lg:col-span-7">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div>
								<h2 className="text-[15px] font-semibold tracking-tight text-foreground">
									{t("updates.frameworks_title")}
								</h2>
								<p className="mt-0.5 text-xs text-subtle">{t("updates.frameworks_hint")}</p>
							</div>
							<div className="inline-flex h-8 items-center rounded-lg border border-border bg-surface p-0.5">
								{(["7d", "30d"] as const).map((r) => (
									<button
										key={r}
										type="button"
										onClick={() => setRadarRange(r)}
										className={
											radarRange === r
												? "inline-flex h-full items-center rounded-[6px] bg-card px-2.5 text-xs font-medium leading-none text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-colors duration-150 dark:bg-surface-subtle dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
												: "inline-flex h-full items-center rounded-[6px] px-2.5 text-xs font-medium leading-none text-subtle transition-colors duration-150 hover:text-foreground"
										}
									>
										{t(r === "7d" ? "updates.range_7d" : "updates.range_30d")}
									</button>
								))}
							</div>
						</div>

						{topFrameworks.length === 0 ? (
							<p className="py-10 text-center text-xs text-subtle">{t("updates.no_data")}</p>
						) : (
							<div className="mt-4 divide-y divide-border/50">
								{topFrameworks.slice(0, 8).map((item, idx) => {
									const active = framework === item.framework;
									const pct = Math.max(4, Math.round((item.count / maxFwCount) * 100));
									return (
										<button
											key={item.framework}
											type="button"
											onClick={() => applyFrameworkFilter(item.framework)}
											className={`group -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors duration-150 ${
												active ? "bg-brand/10" : "hover:bg-surface/80"
											}`}
										>
											<span className="w-5 shrink-0 font-mono text-[11px] tabular-nums text-subtle">
												{String(idx + 1).padStart(2, "0")}
											</span>
											<span
												className={`w-40 shrink-0 truncate text-xs font-medium sm:w-48 ${
													active
														? "text-brand-strong dark:text-brand"
														: "text-foreground group-hover:text-brand-strong dark:group-hover:text-brand"
												}`}
												title={item.framework}
											>
												{item.framework}
											</span>
											<div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-subtle">
												<div
													className={`h-full rounded-full transition-colors duration-150 ${
														active || idx === 0
															? "bg-brand-strong dark:bg-brand"
															: "bg-subtle/45 group-hover:bg-muted/70"
													}`}
													style={{ width: `${pct}%` }}
												/>
											</div>
											<span className="w-12 shrink-0 text-right font-mono text-xs tabular-nums text-muted">
												{fmtNum(item.count)}
											</span>
										</button>
									);
								})}
							</div>
						)}
					</div>

					<div className="flex flex-col p-5 sm:p-6 lg:col-span-5">
						<div>
							<h2 className="text-[15px] font-semibold tracking-tight text-foreground">
								{t("updates.kinds_title")}
							</h2>
							<p className="mt-0.5 text-xs text-subtle">{t("updates.kinds_hint")}</p>
						</div>

						{/* Stacked distribution bar */}
						<div
							className="mt-4 flex h-2 w-full overflow-hidden rounded-full bg-surface-subtle"
							aria-hidden="true"
						>
							{kindBreakdown.total > 0 &&
								kindBreakdown.sorted
									.filter((item) => item.count > 0)
									.map((item) => {
										const share = (item.count / kindBreakdown.total) * 100;
										return (
											<div
												key={item.kind}
												className={`${KIND_SEGMENT_COLOR[item.kind]} first:rounded-l-full last:rounded-r-full`}
												style={{ width: `${Math.max(share, 1.5)}%` }}
											/>
										);
									})}
						</div>

						<div className="mt-4 divide-y divide-border/50">
							{kindBreakdown.sorted.map(({ kind: k, count }) => {
								const active = kind === k;
								const sharePct =
									kindBreakdown.total > 0 ? Math.round((count / kindBreakdown.total) * 100) : 0;
								return (
									<button
										key={k}
										type="button"
										onClick={() => applyKindFilter(k)}
										className={`-mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-xs transition-colors duration-150 ${
											active
												? "bg-brand/10 font-medium text-brand-strong dark:text-brand"
												: count === 0
													? "text-subtle/70 hover:bg-surface/60 hover:text-subtle"
													: "text-foreground hover:bg-surface/80"
										}`}
									>
										<span className="inline-flex min-w-0 items-center gap-2">
											<span
												className={`h-2 w-2 shrink-0 rounded-full ${KIND_SEGMENT_COLOR[k]} ${
													count === 0 ? "opacity-35" : ""
												}`}
												aria-hidden="true"
											/>
											<span className="truncate">{t(`updates.kind_${k}`)}</span>
										</span>
										<span className="inline-flex shrink-0 items-center gap-2.5 font-mono tabular-nums">
											{count > 0 && (
												<span className="text-[11px] text-subtle">
													{sharePct < 1 ? "<1%" : `${sharePct}%`}
												</span>
											)}
											<span className="w-11 text-right text-muted">{fmtNum(count)}</span>
										</span>
									</button>
								);
							})}
						</div>
					</div>
				</section>

				{/* Live Change Timeline */}
				<section className="mt-10">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
						<div>
							<h2 className="text-lg font-semibold tracking-tight text-foreground">
								{t("updates.timeline_title")}
							</h2>
							<p className="mt-0.5 text-xs tabular-nums text-subtle">
								{t("updates.timeline_count", { count: fmtNum(totalEvents) })}
							</p>
						</div>

						{/* Unified h-8 (32px) control toolbar */}
						<div className="flex flex-wrap items-center gap-2">
							<div className="relative">
								<IconSearch
									className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle"
									aria-hidden="true"
								/>
								<input
									type="text"
									value={searchInput}
									onChange={(e) => setSearchInput(e.target.value)}
									placeholder={t("updates.search_placeholder")}
									className="h-8 w-52 rounded-lg border border-border bg-card pl-8 pr-7 text-xs text-foreground placeholder:text-subtle transition-colors duration-150 focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-brand/50 sm:w-64"
								/>
								{searchInput && (
									<button
										type="button"
										onClick={() => {
											setSearchInput("");
											setQuery("");
										}}
										aria-label={t("updates.clear_filters")}
										className="absolute right-2 top-1/2 inline-flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded text-subtle hover:text-foreground"
									>
										<IconX className="h-3 w-3" aria-hidden="true" />
									</button>
								)}
							</div>

							<UpdatesSelect
								value={String(days)}
								options={rangeOptions}
								onChange={(v) => setDays(Number(v))}
								ariaLabel={t("updates.range_label")}
								icon={<IconClock className="h-3.5 w-3.5" />}
								className="min-w-[7.75rem]"
							/>

							<button
								type="button"
								onClick={() =>
									setSignificance((prev) => (prev === "important" ? "all" : "important"))
								}
								className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium leading-none transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 ${
									significance === "all"
										? "border-brand-strong/40 bg-brand/10 text-brand-strong dark:border-brand/40 dark:text-brand"
										: "border-border bg-card text-muted hover:border-border-strong hover:bg-surface hover:text-foreground"
								}`}
							>
								{t(
									significance === "all"
										? "updates.significance_all"
										: "updates.significance_important",
								)}
							</button>
						</div>
					</div>

					{(framework || kind || query) && (
						<div className="mt-3 flex flex-wrap items-center gap-2">
							{framework && (
								<button
									type="button"
									onClick={() => applyFrameworkFilter(framework)}
									className="inline-flex h-7 items-center gap-1.5 rounded-md border border-brand-strong/30 bg-brand/10 px-2.5 font-mono text-xs font-medium text-brand-strong dark:border-brand/30 dark:text-brand"
								>
									<span>{framework}</span>
									<IconX className="h-3 w-3" aria-hidden="true" />
								</button>
							)}
							{kind && (
								<button
									type="button"
									onClick={() => applyKindFilter(kind)}
									className="inline-flex h-7 items-center gap-1.5 rounded-md border border-brand-strong/30 bg-brand/10 px-2.5 text-xs font-medium text-brand-strong dark:border-brand/30 dark:text-brand"
								>
									<span>{t(`updates.kind_${kind}`)}</span>
									<IconX className="h-3 w-3" aria-hidden="true" />
								</button>
							)}
							{query && (
								<button
									type="button"
									onClick={() => {
										setSearchInput("");
										setQuery("");
									}}
									className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-xs text-foreground"
								>
									<span>“{query}”</span>
									<IconX className="h-3 w-3" aria-hidden="true" />
								</button>
							)}
							<button
								type="button"
								onClick={clearAllFilters}
								className="px-1.5 text-xs text-subtle transition-colors hover:text-foreground"
							>
								{t("updates.clear_filters")}
							</button>
						</div>
					)}

					<div
						className={`mt-4 overflow-hidden rounded-2xl border border-border bg-card transition-opacity duration-150 ${
							feedLoading && events.length > 0 ? "opacity-60" : "opacity-100"
						}`}
					>
						{feedLoading && events.length === 0 ? (
							<div className="py-14 text-center text-sm text-subtle" role="status">
								{t("common.loading")}
							</div>
						) : feedError && events.length === 0 ? (
							<div
								role="alert"
								className="flex flex-col items-center justify-center gap-3 py-14 text-center"
							>
								<p className="text-sm text-destructive">{t("updates.load_error")}</p>
								<Button variant="outline" size="sm" onClick={() => setFeedAttempt((v) => v + 1)}>
									{t("common.retry")}
								</Button>
							</div>
						) : events.length === 0 ? (
							<div className="py-14 text-center">
								<p className="text-sm text-subtle">{t("updates.timeline_empty")}</p>
							</div>
						) : (
							<>
								<div className="divide-y divide-border">
									{events.map((event) => (
										<ChangeEventCard
											key={event.id}
											event={event}
											onFilterFramework={applyFrameworkFilter}
										/>
									))}
								</div>
								{hasMore && (
									<div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface/35 px-5 py-3.5 sm:px-6">
										<span className="font-mono text-xs tabular-nums text-subtle">
											{t("updates.showing_of", {
												shown: fmtNum(events.length),
												total: fmtNum(totalEvents),
											})}
										</span>
										<Button
											variant="outline"
											size="sm"
											loading={loadingMore}
											onClick={handleLoadMore}
											className="h-8"
										>
											{t("updates.load_more")}
										</Button>
									</div>
								)}
							</>
						)}
					</div>
				</section>

				{/* Subtle Agent CTA */}
				<section className="mt-10 rounded-2xl border border-border bg-surface/50 px-6 py-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
					<div>
						<h2 className="text-base font-semibold tracking-tight text-foreground">
							{t("updates.cta_title")}
						</h2>
						<p className="mt-1 text-sm text-muted">{t("updates.cta_subtitle")}</p>
					</div>
					<Button variant="primary" size="sm" asChild className="mt-4 h-9 shrink-0 px-4 sm:mt-0">
						<Link to="/connect">
							<span>{t("updates.cta_button")}</span>
							<IconArrowRight className="h-4 w-4" aria-hidden="true" />
						</Link>
					</Button>
				</section>
			</main>
			<Footer />
		</div>
	);
}
