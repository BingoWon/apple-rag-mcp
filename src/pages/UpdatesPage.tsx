import {
	IconActivity,
	IconArrowRight,
	IconBraces,
	IconCheck,
	IconDatabase,
	IconRadar2,
	IconRss,
	IconSearch,
	IconX,
} from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { AppNavbar } from "@/components/ui/resizable-navbar";
import { ChangeEventCard } from "@/components/updates/ChangeEventCard";
import { DigestPanel } from "@/components/updates/DigestPanel";
import { usePageScroll } from "@/hooks/usePageScroll";
import { api } from "@/lib/api";
import type { CorpusStats } from "@/types";
import {
	type DigestPeriodType,
	DOC_CHANGE_KINDS,
	type DocChangeDigest,
	type DocChangeEventItem,
	type UpdatesSummaryResponse,
} from "../../shared/doc-updates";

function formatRelativeMinutes(iso: string | null, locale: string): string {
	if (!iso) return "—";
	const diffSec = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
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

	const [summary, setSummary] = useState<UpdatesSummaryResponse | null>(null);
	const [corpus, setCorpus] = useState<CorpusStats | null>(null);
	const [digestPeriod, setDigestPeriod] = useState<DigestPeriodType>("daily");
	const [digestsByPeriod, setDigestsByPeriod] = useState<
		Record<DigestPeriodType, DocChangeDigest[]>
	>({ daily: [], weekly: [] });
	const [selectedKeyByPeriod, setSelectedKeyByPeriod] = useState<
		Record<DigestPeriodType, string | null>
	>({ daily: null, weekly: null });
	const [loadedPeriods, setLoadedPeriods] = useState<Record<DigestPeriodType, boolean>>({
		daily: false,
		weekly: false,
	});

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
	const [loadingMore, setLoadingMore] = useState(false);

	// Load summary, corpus stats, and both daily & weekly digest histories in parallel
	// so switching between daily/weekly tabs is instantaneous with zero layout jump.
	useEffect(() => {
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
			api
				.getUpdatesDigests(period, 14, controller.signal)
				.then((res) => {
					if (controller.signal.aborted) return;
					const list = res.success && res.data ? res.data.digests : [];
					setDigestsByPeriod((prev) => ({ ...prev, [period]: list }));
					setSelectedKeyByPeriod((prev) => ({
						...prev,
						[period]: prev[period] ?? list[0]?.period_key ?? null,
					}));
				})
				.catch(() => {})
				.finally(() => {
					if (!controller.signal.aborted) {
						setLoadedPeriods((prev) => ({ ...prev, [period]: true }));
					}
				});
		}

		return () => controller.abort();
	}, []);

	// Debounce search input
	useEffect(() => {
		const id = window.setTimeout(() => setQuery(searchInput.trim()), 250);
		return () => window.clearTimeout(id);
	}, [searchInput]);

	// Sync URL query params for shareable filters
	const applyFrameworkFilter = useCallback(
		(nextFramework: string) => {
			setFramework((prev) => {
				const resolved = prev === nextFramework ? "" : nextFramework;
				const next = new URLSearchParams(searchParams);
				if (resolved) next.set("framework", resolved);
				else next.delete("framework");
				setSearchParams(next, { replace: true });
				return resolved;
			});
		},
		[searchParams, setSearchParams],
	);

	// Load event feed
	useEffect(() => {
		const controller = new AbortController();
		setFeedLoading(true);
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
				}
			})
			.catch(() => {
				if (!controller.signal.aborted) {
					setEvents([]);
					setTotalEvents(0);
					setHasMore(false);
				}
			})
			.finally(() => {
				if (!controller.signal.aborted) setFeedLoading(false);
			});
		return () => controller.abort();
	}, [framework, kind, significance, days, query]);

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
				setEvents((prev) => [...prev, ...res.data!.events]);
				setTotalEvents(res.data.total);
				setHasMore(res.data.has_more);
			}
		} finally {
			setLoadingMore(false);
		}
	};

	const topFrameworks =
		radarRange === "7d" ? (summary?.top_frameworks_7d ?? []) : (summary?.top_frameworks_30d ?? []);
	const byKind = radarRange === "7d" ? (summary?.by_kind_7d ?? {}) : (summary?.by_kind_30d ?? {});
	const maxFwCount = Math.max(1, ...topFrameworks.map((f) => f.count));
	const fmtNum = (n: number) => new Intl.NumberFormat(locale).format(n);

	return (
		<div className="min-h-screen bg-background text-foreground">
			<AppNavbar />
			<main className="mx-auto max-w-5xl px-4 pb-16 pt-28 sm:px-6 sm:pt-32">
				{/* Header */}
				<header className="flex flex-wrap items-end justify-between gap-4">
					<div className="max-w-2xl">
						<div className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
							<IconRadar2 className="h-3.5 w-3.5" aria-hidden="true" />
							<span>{t("updates.eyebrow")}</span>
						</div>
						<h1 className="mt-3 text-3xl font-bold tracking-tight text-light sm:text-4xl">
							{t("updates.title")}
						</h1>
						<p className="mt-2.5 text-sm leading-relaxed text-muted sm:text-base">
							{t("updates.subtitle")}
						</p>
					</div>

					<div className="flex items-center gap-2">
						<Button asChild variant="outline" size="sm">
							<a href="/api/updates/rss.xml" target="_blank" rel="noopener noreferrer">
								<IconRss className="h-4 w-4 text-warning" aria-hidden="true" />
								<span>RSS</span>
							</a>
						</Button>
						<Button asChild variant="outline" size="sm">
							<a href="/api/updates/feed.json" target="_blank" rel="noopener noreferrer">
								<IconBraces className="h-4 w-4 text-brand" aria-hidden="true" />
								<span>JSON Feed</span>
							</a>
						</Button>
					</div>
				</header>

				{/* Live Collector Heartbeat Trust Bar */}
				<section
					aria-label={t("updates.heartbeat_aria")}
					className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4"
				>
					<div className="rounded-xl border border-default bg-card p-4">
						<div className="flex items-center gap-2 text-xs text-muted-foreground">
							<span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
							<span>{t("updates.metric_last_run")}</span>
						</div>
						<p className="mt-2 text-lg font-bold tabular-nums text-light">
							{formatRelativeMinutes(summary?.heartbeat.last_run_at ?? null, locale)}
						</p>
						<p className="mt-0.5 text-[11px] text-muted-foreground">
							{summary?.heartbeat.last_sweep_source
								? t(`updates.source_${summary.heartbeat.last_sweep_source}`)
								: t("updates.cadence_label")}
						</p>
					</div>

					<div className="rounded-xl border border-default bg-card p-4">
						<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
							<IconActivity className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
							<span>{t("updates.metric_scanned_24h")}</span>
						</div>
						<p className="mt-2 text-lg font-bold tabular-nums text-light">
							{summary ? fmtNum(summary.heartbeat.scanned_24h) : "—"}
						</p>
						<p className="mt-0.5 text-[11px] text-muted-foreground">
							{summary
								? t("updates.metric_not_modified", {
										count: fmtNum(summary.heartbeat.not_modified_24h),
									})
								: "\u00A0"}
						</p>
					</div>

					<div className="rounded-xl border border-default bg-card p-4">
						<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
							<IconDatabase className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
							<span>{t("updates.metric_changes")}</span>
						</div>
						<p className="mt-2 text-lg font-bold tabular-nums text-light">
							{summary ? fmtNum(summary.heartbeat.changed_24h) : "—"}
							<span className="ml-1.5 text-xs font-normal text-muted-foreground">
								/ 7d: {summary ? fmtNum(summary.heartbeat.changed_7d) : "—"}
							</span>
						</p>
						<p className="mt-0.5 text-[11px] text-muted-foreground">
							{t("updates.metric_changes_hint")}
						</p>
					</div>

					<div className="rounded-xl border border-default bg-card p-4">
						<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
							<IconCheck className="h-3.5 w-3.5 text-success" aria-hidden="true" />
							<span>{t("updates.metric_coverage")}</span>
						</div>
						<p className="mt-2 text-lg font-bold tabular-nums text-light">
							{corpus?.embedded_percentage != null ? `${corpus.embedded_percentage}%` : "—"}
						</p>
						<p className="mt-0.5 text-[11px] text-muted-foreground">
							{corpus
								? t("updates.metric_docs_total", { count: fmtNum(corpus.docs_total) })
								: "\u00A0"}
						</p>
					</div>
				</section>

				{/* AI Trend Digest */}
				<section className="mt-6">
					<DigestPanel
						period={digestPeriod}
						onPeriodChange={setDigestPeriod}
						digests={digestsByPeriod[digestPeriod]}
						selectedKey={selectedKeyByPeriod[digestPeriod]}
						onSelectKey={(key) =>
							setSelectedKeyByPeriod((prev) => ({ ...prev, [digestPeriod]: key }))
						}
						loading={!loadedPeriods[digestPeriod] && digestsByPeriod[digestPeriod].length === 0}
						onFilterFramework={applyFrameworkFilter}
					/>
				</section>

				{/* Framework & Kind Radar */}
				<section className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-12">
					<Card className="border-default bg-card lg:col-span-7">
						<CardContent className="p-5">
							<div className="flex items-center justify-between gap-2">
								<div>
									<h2 className="text-sm font-semibold text-light">
										{t("updates.frameworks_title")}
									</h2>
									<p className="text-xs text-muted-foreground">{t("updates.frameworks_hint")}</p>
								</div>
								<div className="inline-flex rounded-lg border border-default bg-secondary p-0.5">
									{(["7d", "30d"] as const).map((r) => (
										<button
											key={r}
											type="button"
											onClick={() => setRadarRange(r)}
											className={
												radarRange === r
													? "rounded-md bg-brand px-2.5 py-0.5 text-xs font-semibold text-brand-foreground"
													: "rounded-md px-2.5 py-0.5 text-xs text-muted-foreground hover:text-light"
											}
										>
											{r}
										</button>
									))}
								</div>
							</div>

							{topFrameworks.length === 0 ? (
								<p className="py-8 text-center text-xs text-muted-foreground">
									{t("updates.no_data")}
								</p>
							) : (
								<div className="mt-4 space-y-2">
									{topFrameworks.slice(0, 10).map((item) => {
										const active = framework === item.framework;
										const pct = Math.max(8, Math.round((item.count / maxFwCount) * 100));
										return (
											<button
												key={item.framework}
												type="button"
												onClick={() => applyFrameworkFilter(item.framework)}
												className={`group flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
													active
														? "border-brand bg-brand/10"
														: "border-transparent bg-secondary/50 hover:border-default"
												}`}
											>
												<span className="w-36 shrink-0 truncate text-xs font-semibold text-light">
													{item.framework}
												</span>
												<div className="h-2 flex-1 overflow-hidden rounded-full bg-tertiary">
													<div
														className="h-full rounded-full bg-brand"
														style={{ width: `${pct}%` }}
													/>
												</div>
												<span className="w-10 shrink-0 text-right font-mono text-xs font-semibold tabular-nums text-muted-foreground">
													{fmtNum(item.count)}
												</span>
											</button>
										);
									})}
								</div>
							)}
						</CardContent>
					</Card>

					<Card className="border-default bg-card lg:col-span-5">
						<CardContent className="p-5">
							<h2 className="text-sm font-semibold text-light">{t("updates.kinds_title")}</h2>
							<p className="text-xs text-muted-foreground">{t("updates.kinds_hint")}</p>

							<div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
								{DOC_CHANGE_KINDS.map((k) => {
									const count = byKind[k] ?? 0;
									const active = kind === k;
									return (
										<button
											key={k}
											type="button"
											onClick={() => setKind((prev) => (prev === k ? "" : k))}
											className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition-colors ${
												active
													? "border-brand bg-brand/10 font-semibold text-brand"
													: "border-default bg-secondary/40 text-light hover:border-border-light"
											}`}
										>
											<span>{t(`updates.kind_${k}`)}</span>
											<span className="font-mono font-semibold tabular-nums text-muted-foreground">
												{fmtNum(count)}
											</span>
										</button>
									);
								})}
							</div>
						</CardContent>
					</Card>
				</section>

				{/* Change Timeline */}
				<section className="mt-8">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div>
							<h2 className="text-lg font-bold text-light">{t("updates.timeline_title")}</h2>
							<p className="text-xs text-muted-foreground">
								{t("updates.timeline_count", { count: fmtNum(totalEvents) })}
							</p>
						</div>

						<div className="flex flex-wrap items-center gap-2">
							<div className="relative">
								<IconSearch
									className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
									aria-hidden="true"
								/>
								<input
									type="search"
									value={searchInput}
									onChange={(e) => setSearchInput(e.target.value)}
									placeholder={t("updates.search_placeholder")}
									className="h-8 w-48 rounded-lg border border-default bg-card pl-8 pr-3 text-xs text-light placeholder:text-muted-foreground focus:border-brand focus:outline-none sm:w-56"
								/>
							</div>

							<select
								aria-label={t("updates.range_label")}
								value={days}
								onChange={(e) => setDays(Number(e.target.value))}
								className="h-8 rounded-lg border border-default bg-card px-2.5 text-xs font-medium text-light focus:border-brand focus:outline-none"
							>
								<option value={1}>{t("updates.range_1d")}</option>
								<option value={7}>{t("updates.range_7d")}</option>
								<option value={30}>{t("updates.range_30d")}</option>
								<option value={90}>{t("updates.range_90d")}</option>
							</select>

							<button
								type="button"
								onClick={() =>
									setSignificance((prev) => (prev === "important" ? "all" : "important"))
								}
								className={
									significance === "all"
										? "h-8 rounded-lg border border-brand bg-brand/10 px-2.5 text-xs font-semibold text-brand"
										: "h-8 rounded-lg border border-default bg-card px-2.5 text-xs font-medium text-muted-foreground hover:text-light"
								}
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
									className="inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand"
								>
									<span>{framework}</span>
									<IconX className="h-3 w-3" aria-hidden="true" />
								</button>
							)}
							{kind && (
								<button
									type="button"
									onClick={() => setKind("")}
									className="inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand"
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
									className="inline-flex items-center gap-1 rounded-full border border-default bg-secondary px-2.5 py-1 text-xs text-light"
								>
									<span>“{query}”</span>
									<IconX className="h-3 w-3" aria-hidden="true" />
								</button>
							)}
						</div>
					)}

					<div
						className={`mt-4 space-y-3 transition-opacity duration-150 ${
							feedLoading && events.length > 0 ? "opacity-60" : "opacity-100"
						}`}
					>
						{feedLoading && events.length === 0 ? (
							<div
								className="rounded-xl border border-default bg-card py-12 text-center text-sm text-muted-foreground"
								role="status"
							>
								{t("common.loading")}
							</div>
						) : events.length === 0 ? (
							<div className="rounded-xl border border-default bg-card py-12 text-center">
								<p className="text-sm text-muted-foreground">{t("updates.timeline_empty")}</p>
							</div>
						) : (
							<>
								{events.map((event) => (
									<ChangeEventCard
										key={event.id}
										event={event}
										onFilterFramework={applyFrameworkFilter}
									/>
								))}
								{hasMore && (
									<div className="pt-2 text-center">
										<Button
											variant="outline"
											size="sm"
											loading={loadingMore}
											onClick={handleLoadMore}
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
				<section className="mt-10 rounded-2xl border border-default bg-card p-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
					<div>
						<h2 className="text-base font-bold text-light sm:text-lg">{t("updates.cta_title")}</h2>
						<p className="mt-1 text-sm text-muted-foreground">{t("updates.cta_subtitle")}</p>
					</div>
					<Button variant="primary" asChild className="mt-4 shrink-0 sm:mt-0">
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
