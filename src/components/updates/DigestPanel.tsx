import { IconArrowUpRight, IconCalendar } from "@tabler/icons-react";
import type { TFunction } from "i18next";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { UpdatesSelect } from "@/components/updates/UpdatesSelect";
import { parseUTCDate } from "../../../shared/datetime";
import type { DigestPeriodType, DocChangeDigest } from "../../../shared/doc-updates";

interface DigestPanelProps {
	period: DigestPeriodType;
	onPeriodChange: (period: DigestPeriodType) => void;
	digests: readonly DocChangeDigest[];
	selectedKey: string | null;
	onSelectKey: (key: string) => void;
	loading: boolean;
	error?: boolean;
	onRetry?: () => void;
	onFilterFramework: (framework: string) => void;
	className?: string;
}

const ALERT_DOT: Record<string, string> = {
	deprecated: "bg-destructive",
	removed: "bg-destructive",
	breaking: "bg-destructive",
	beta: "bg-warning",
};

const ALERT_TEXT: Record<string, string> = {
	deprecated: "text-destructive",
	removed: "text-destructive",
	breaking: "text-destructive",
	beta: "text-amber-600 dark:text-warning",
};

function shortModelLabel(provider: string, model: string, t: TFunction): string {
	if (provider === "rules") return t("updates.digest_rules_engine");
	const tail = model.split("/").pop() || model;
	if (provider === "cloudflare-workers-ai") return `Cloudflare Workers AI · ${tail}`;
	if (provider === "zenmux") return `ZenMux · ${tail}`;
	return `${provider} · ${tail}`;
}

function formatDocReference(url: string): string {
	try {
		const segments = new URL(url).pathname.replace(/\/+$/, "").split("/").filter(Boolean);
		const last = segments[segments.length - 1] ?? "";
		if (!last) return "Apple Docs";
		return decodeURIComponent(last).replace(/-swift\.(enum|struct|class|protocol|property)$/, "");
	} catch {
		return url.replace(/\/$/, "").split("/").pop() || "Apple Docs";
	}
}

export function DigestPanel({
	period,
	onPeriodChange,
	digests,
	selectedKey,
	onSelectKey,
	loading,
	error = false,
	onRetry,
	onFilterFramework,
	className,
}: DigestPanelProps) {
	const { t, i18n } = useTranslation();
	const locale = i18n.resolvedLanguage ?? "en";
	const isZh = locale.startsWith("zh");
	const [hoveredKey, setHoveredKey] = useState<string | null>(null);

	const active = digests.find((d) => d.period_key === selectedKey) ?? digests[0] ?? null;
	const copy = active ? (isZh ? active.content_zh : active.content_en) : null;
	const numFmt = useMemo(() => new Intl.NumberFormat(locale), [locale]);
	const fmtNum = (n: number) => numFmt.format(n);

	// Chronological order (oldest -> newest) for the interactive activity pulse strip
	const chronological = useMemo(() => [...digests].reverse(), [digests]);
	const maxEvents = useMemo(
		() => Math.max(1, ...chronological.map((d) => d.stats.total_events)),
		[chronological],
	);
	const inspected =
		chronological.find((d) => d.period_key === hoveredKey) ?? active ?? chronological[0] ?? null;

	const selectOptions = useMemo(
		() =>
			digests.map((d) => ({
				value: d.period_key,
				label: d.period_key,
				meta: numFmt.format(d.stats.total_events),
			})),
		[digests, numFmt],
	);

	return (
		<section
			aria-label={t("updates.digest_title")}
			className={`overflow-hidden rounded-2xl border border-border bg-card${className ? ` ${className}` : ""}`}
		>
			{/* Header bar: single row, exact h-8 (32px) controls */}
			<div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
				<div className="min-w-0">
					<h2 className="text-[15px] font-semibold tracking-tight text-foreground sm:text-base">
						{t("updates.digest_title")}
					</h2>
					<p className="mt-0.5 text-xs text-subtle">{t("updates.digest_subtitle")}</p>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<div
						className="inline-flex h-8 items-center rounded-lg border border-border bg-surface p-0.5"
						role="tablist"
						aria-label={t("updates.digest_title")}
					>
						{(["daily", "weekly"] as const).map((tab) => {
							const isActive = period === tab;
							return (
								<button
									key={tab}
									type="button"
									role="tab"
									aria-selected={isActive}
									onClick={() => onPeriodChange(tab)}
									className={
										isActive
											? "inline-flex h-full items-center rounded-[6px] bg-card px-3 text-xs font-medium leading-none text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-colors duration-150 dark:bg-surface-subtle dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
											: "inline-flex h-full items-center rounded-[6px] px-3 text-xs font-medium leading-none text-subtle transition-colors duration-150 hover:text-foreground"
									}
								>
									{t(tab === "daily" ? "updates.digest_daily" : "updates.digest_weekly")}
								</button>
							);
						})}
					</div>

					{digests.length > 1 && active && (
						<UpdatesSelect
							value={active.period_key}
							options={selectOptions}
							onChange={onSelectKey}
							ariaLabel={t("updates.digest_period_select")}
							icon={<IconCalendar className="h-3.5 w-3.5" />}
							mono
							className="min-w-[8.25rem]"
						/>
					)}
				</div>
			</div>

			{/* Signature Moment: Compact interactive Apple Docs Pulse bar strip */}
			{chronological.length > 1 && inspected && (
				<div className="flex flex-col gap-3 border-b border-border bg-surface/40 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6">
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
							<span className="font-mono font-medium tabular-nums text-foreground">
								{inspected.period_key}
							</span>
							<span className="text-border-strong" aria-hidden="true">
								·
							</span>
							<span className="tabular-nums text-muted">
								{t("updates.digest_sample_meta", {
									events: fmtNum(inspected.stats.total_events),
									frameworks: fmtNum(inspected.stats.frameworks_touched),
								})}
							</span>
							{inspected.stats.high_significance > 0 && (
								<>
									<span className="hidden text-border-strong sm:inline" aria-hidden="true">
										·
									</span>
									<span className="font-mono tabular-nums text-brand-strong dark:text-brand">
										{t("updates.pulse_high_impact", {
											count: fmtNum(inspected.stats.high_significance),
										})}
									</span>
								</>
							)}
						</div>
						<p className="mt-0.5 font-mono text-[11px] tabular-nums text-subtle">
							{t("updates.pulse_label", { count: chronological.length })} ·{" "}
							{chronological[0]?.period_key} – {chronological[chronological.length - 1]?.period_key}
						</p>
					</div>

					<div className="flex h-9 w-full shrink-0 items-end justify-start gap-1.5 border-b border-border/80 pb-px sm:w-64 sm:justify-end md:w-72">
						{chronological.map((item) => {
							const isSelected = item.period_key === active?.period_key;
							const isHovered = item.period_key === hoveredKey;
							const heightPct = Math.max(
								18,
								Math.round((item.stats.total_events / maxEvents) * 100),
							);
							const highSharePct =
								item.stats.total_events > 0
									? Math.min(
											100,
											Math.round((item.stats.high_significance / item.stats.total_events) * 100),
										)
									: 0;
							return (
								<button
									key={item.period_key}
									type="button"
									onClick={() => onSelectKey(item.period_key)}
									onMouseEnter={() => setHoveredKey(item.period_key)}
									onMouseLeave={() =>
										setHoveredKey((prev) => (prev === item.period_key ? null : prev))
									}
									onFocus={() => setHoveredKey(item.period_key)}
									onBlur={() => setHoveredKey(null)}
									aria-pressed={isSelected}
									aria-label={`${item.period_key}: ${fmtNum(item.stats.total_events)}`}
									className={`group relative flex h-full flex-col items-center justify-end rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 ${
										chronological.length <= 6 ? "w-8 sm:w-9" : "flex-1"
									}`}
								>
									<div
										className={`relative w-full overflow-hidden rounded-t-[3px] transition-colors duration-150 ${
											isSelected
												? "bg-brand-strong/25 dark:bg-brand/25"
												: isHovered
													? "bg-border-strong"
													: "bg-border/90 dark:bg-border"
										}`}
										style={{ height: `${heightPct}%` }}
									>
										<div
											className={`absolute inset-x-0 bottom-0 transition-colors duration-150 ${
												isSelected
													? "bg-brand-strong dark:bg-brand"
													: isHovered
														? "bg-muted/70"
														: "bg-subtle/45"
											}`}
											style={{
												height: `${Math.max(isSelected ? 40 : 24, highSharePct)}%`,
											}}
										/>
									</div>
								</button>
							);
						})}
					</div>
				</div>
			)}

			{/* Editorial Body: flat typography + hairlines, zero nested boxes */}
			{loading && !active ? (
				<div
					className="flex min-h-[280px] items-center justify-center text-sm text-subtle"
					role="status"
				>
					{t("common.loading")}
				</div>
			) : error && !active ? (
				<div
					role="alert"
					className="flex min-h-[220px] flex-col items-center justify-center gap-3 px-6 text-center"
				>
					<p className="text-sm text-destructive">{t("updates.load_error")}</p>
					{onRetry && (
						<button
							type="button"
							onClick={onRetry}
							className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground transition-colors hover:bg-surface-subtle"
						>
							{t("common.retry")}
						</button>
					)}
				</div>
			) : !active || !copy ? (
				<div className="flex min-h-[200px] items-center justify-center px-6 text-center">
					<p className="text-sm text-subtle">{t("updates.digest_empty")}</p>
				</div>
			) : (
				<>
					<div className="px-5 py-6 sm:px-6">
						{/* Meta & Headline */}
						<div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-subtle">
							<a
								href={`/updates/digest/${active.period_type}/${encodeURIComponent(active.period_key)}`}
								className="inline-flex items-center gap-1 font-mono font-medium tabular-nums text-foreground transition-colors hover:text-brand-strong dark:hover:text-brand"
							>
								<span>{active.period_key}</span>
								<IconArrowUpRight className="h-3.5 w-3.5 text-subtle" aria-hidden="true" />
							</a>
							<span className="text-border-strong" aria-hidden="true">
								·
							</span>
							<span className="tabular-nums">
								{t("updates.digest_sample_meta", {
									events: fmtNum(active.stats.total_events),
									frameworks: fmtNum(active.stats.frameworks_touched),
								})}
							</span>
						</div>

						<h3 className="mt-2.5 text-xl font-semibold leading-snug tracking-[-0.02em] text-foreground sm:text-2xl">
							{copy.headline}
						</h3>
						<p className="mt-2.5 max-w-3xl text-sm leading-relaxed text-muted sm:text-[15px]">
							{copy.overview}
						</p>

						{/* Takeaways: editorial left-accent rule instead of nested card */}
						{copy.strategy_notes.length > 0 && (
							<div className="mt-6 border-l-2 border-brand-strong/70 pl-4 dark:border-brand/70">
								<h4 className="text-xs font-medium text-subtle">{t("updates.strategy_notes")}</h4>
								<ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-foreground/90">
									{copy.strategy_notes.map((note, idx) => (
										<li key={idx}>{note}</li>
									))}
								</ul>
							</div>
						)}

						{/* Active Module Highlights: clean hairline grid, zero nested borders */}
						{copy.highlights.length > 0 && (
							<div className="mt-7 border-t border-border pt-5">
								<h4 className="text-xs font-medium text-subtle">{t("updates.highlights_title")}</h4>
								<div className="mt-3 grid grid-cols-1 gap-x-8 md:grid-cols-2">
									{copy.highlights.map((item, idx) => (
										<div
											key={`${item.framework}-${idx}`}
											className="flex flex-col justify-between border-b border-border/60 py-4 last:border-b-0 md:[&:nth-last-child(2):nth-child(odd)]:border-b-0"
										>
											<div>
												<button
													type="button"
													onClick={() => onFilterFramework(item.framework)}
													className="font-mono text-xs font-medium text-brand-strong transition-colors hover:underline dark:text-brand"
												>
													{item.framework}
												</button>
												<p className="mt-1 text-sm font-medium leading-snug text-foreground">
													{item.title}
												</p>
												<p className="mt-1 text-xs leading-relaxed text-muted">{item.summary}</p>
											</div>
											{item.urls.length > 0 && (
												<div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
													{item.urls.slice(0, 3).map((url) => (
														<a
															key={url}
															href={url}
															target="_blank"
															rel="noopener noreferrer"
															className="inline-flex items-center gap-0.5 font-mono text-[11px] text-subtle transition-colors hover:text-foreground"
														>
															<span className="max-w-[180px] truncate">
																{formatDocReference(url)}
															</span>
															<IconArrowUpRight className="h-3 w-3 shrink-0" aria-hidden="true" />
														</a>
													))}
												</div>
											)}
										</div>
									))}
								</div>
							</div>
						)}

						{/* Deprecations & Beta Alerts: clean hairline rows */}
						{copy.alerts.length > 0 && (
							<div className="mt-6 border-t border-border pt-5">
								<h4 className="text-xs font-medium text-subtle">{t("updates.alerts_title")}</h4>
								<div className="mt-2 divide-y divide-border/60">
									{copy.alerts.map((alert, idx) => (
										<a
											key={`${alert.url}-${idx}`}
											href={alert.url}
											target="_blank"
											rel="noopener noreferrer"
											className="-mx-2 flex items-start justify-between gap-4 rounded-lg px-2 py-3 transition-colors duration-150 hover:bg-surface/80"
										>
											<div className="min-w-0 flex-1">
												<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
													<span className="inline-flex items-center gap-1.5 text-xs font-medium">
														<span
															className={`h-1.5 w-1.5 rounded-full ${ALERT_DOT[alert.kind] ?? ALERT_DOT.beta}`}
															aria-hidden="true"
														/>
														<span className={ALERT_TEXT[alert.kind] ?? ALERT_TEXT.beta}>
															{t(`updates.alert_kind_${alert.kind}`)}
														</span>
													</span>
													<span className="text-border-strong" aria-hidden="true">
														·
													</span>
													<span className="font-mono text-xs text-muted">{alert.framework}</span>
													<span className="text-xs font-medium text-foreground">{alert.title}</span>
												</div>
												<p className="mt-1 text-xs leading-relaxed text-subtle">{alert.note}</p>
											</div>
											<IconArrowUpRight
												className="mt-0.5 h-4 w-4 shrink-0 text-subtle"
												aria-hidden="true"
											/>
										</a>
									))}
								</div>
							</div>
						)}
					</div>

					{/* Quiet footer strip */}
					<div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface/35 px-5 py-3 text-xs text-subtle sm:px-6">
						<span>
							{t("updates.digest_engine", {
								engine: shortModelLabel(active.provider, active.model, t),
							})}
						</span>
						<span className="tabular-nums">
							{t("updates.digest_generated_at", {
								time: (() => {
									const d = parseUTCDate(active.generated_at);
									return d
										? new Intl.DateTimeFormat(locale, {
												dateStyle: "medium",
												timeStyle: "short",
											}).format(d)
										: "—";
								})(),
							})}
						</span>
					</div>
				</>
			)}
		</section>
	);
}
