import {
	IconAlertTriangle,
	IconExternalLink,
	IconSparkles,
	IconTrendingUp,
} from "@tabler/icons-react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/Card";
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
}

const ALERT_STYLE: Record<string, string> = {
	deprecated: "border-destructive/30 bg-destructive/10 text-destructive",
	removed: "border-destructive/30 bg-destructive/10 text-destructive",
	breaking: "border-destructive/30 bg-destructive/10 text-destructive",
	beta: "border-warning/30 bg-warning/10 text-warning",
};

function shortModelLabel(provider: string, model: string, t: TFunction): string {
	if (provider === "rules") return t("updates.digest_rules_engine");
	const tail = model.split("/").pop() || model;
	if (provider === "cloudflare-workers-ai") return `Cloudflare Workers AI · ${tail}`;
	if (provider === "zenmux") return `ZenMux · ${tail}`;
	return `${provider} · ${tail}`;
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
}: DigestPanelProps) {
	const { t, i18n } = useTranslation();
	const isZh = (i18n.resolvedLanguage ?? "en").startsWith("zh");
	const active = digests.find((d) => d.period_key === selectedKey) ?? digests[0] ?? null;
	const copy = active ? (isZh ? active.content_zh : active.content_en) : null;

	return (
		<Card className="overflow-hidden border-border bg-card">
			<CardContent className="p-5 sm:p-6">
				<div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
					<div className="flex items-center gap-2.5">
						<div className="flex h-9 w-9 items-center justify-center rounded-xl border border-brand/25 bg-brand/10 text-brand">
							<IconSparkles className="h-5 w-5" aria-hidden="true" />
						</div>
						<div>
							<h2 className="text-base font-semibold text-foreground sm:text-lg">
								{t("updates.digest_title")}
							</h2>
							<p className="text-xs text-subtle">{t("updates.digest_subtitle")}</p>
						</div>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<div
							className="inline-flex rounded-lg border border-border bg-surface p-0.5"
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
												? "rounded-md bg-brand px-3 py-1 text-xs font-semibold text-brand-foreground"
												: "rounded-md px-3 py-1 text-xs font-medium text-subtle hover:text-foreground"
										}
									>
										{t(tab === "daily" ? "updates.digest_daily" : "updates.digest_weekly")}
									</button>
								);
							})}
						</div>

						{digests.length > 1 && active && (
							<select
								aria-label={t("updates.digest_period_select")}
								value={active.period_key}
								onChange={(e) => onSelectKey(e.target.value)}
								className="h-8 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-foreground focus:border-brand focus:outline-none"
							>
								{digests.map((d) => (
									<option key={d.period_key} value={d.period_key}>
										{d.period_key}
									</option>
								))}
							</select>
						)}
					</div>
				</div>

				{loading && !active ? (
					<div
						className="flex min-h-[320px] items-center justify-center text-sm text-subtle"
						role="status"
					>
						{t("common.loading")}
					</div>
				) : error && !active ? (
					<div
						role="alert"
						className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-center"
					>
						<p className="text-sm text-destructive">{t("updates.load_error")}</p>
						{onRetry && (
							<button
								type="button"
								onClick={onRetry}
								className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-subtle"
							>
								{t("common.retry")}
							</button>
						)}
					</div>
				) : !active || !copy ? (
					<div className="flex min-h-[240px] items-center justify-center text-center">
						<p className="text-sm text-subtle">{t("updates.digest_empty")}</p>
					</div>
				) : (
					<div className="mt-5 min-h-[320px] space-y-6">
						<div>
							<div className="flex flex-wrap items-center gap-2 text-xs text-subtle">
								<span className="rounded-md border border-border bg-surface px-2 py-0.5 font-mono">
									{active.period_key}
								</span>
								<span>
									{t("updates.digest_sample_meta", {
										events: active.stats.total_events,
										frameworks: active.stats.frameworks_touched,
									})}
								</span>
							</div>
							<h3 className="mt-2.5 text-lg font-bold tracking-tight text-foreground sm:text-xl">
								{copy.headline}
							</h3>
							<p className="mt-2 text-sm leading-relaxed text-muted">{copy.overview}</p>
						</div>

						{copy.strategy_notes.length > 0 && (
							<div className="rounded-xl border border-border bg-surface/70 p-4">
								<div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-foreground">
									<IconTrendingUp className="h-4 w-4 text-brand" aria-hidden="true" />
									<span>{t("updates.strategy_notes")}</span>
								</div>
								<ul className="space-y-1.5 text-sm text-muted">
									{copy.strategy_notes.map((note, idx) => (
										<li key={idx} className="flex items-start gap-2">
											<span
												aria-hidden="true"
												className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
											/>
											<span className="leading-relaxed">{note}</span>
										</li>
									))}
								</ul>
							</div>
						)}

						{copy.highlights.length > 0 && (
							<div>
								<h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-subtle">
									{t("updates.highlights_title")}
								</h4>
								<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
									{copy.highlights.map((item, idx) => (
										<div
											key={idx}
											className="flex flex-col justify-between rounded-xl border border-border bg-surface/50 p-4"
										>
											<div>
												<button
													type="button"
													onClick={() => onFilterFramework(item.framework)}
													className="inline-flex items-center rounded-md border border-brand/25 bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand hover:bg-brand/20"
												>
													{item.framework}
												</button>
												<p className="mt-2 text-sm font-semibold text-foreground">{item.title}</p>
												<p className="mt-1 text-xs leading-relaxed text-subtle">{item.summary}</p>
											</div>
											{item.urls.length > 0 && (
												<div className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-2.5">
													{item.urls.slice(0, 3).map((url) => {
														const slug = url.replace(/\/$/, "").split("/").pop() || "Apple Docs";
														return (
															<a
																key={url}
																href={url}
																target="_blank"
																rel="noopener noreferrer"
																className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
															>
																<span className="max-w-[160px] truncate">{slug}</span>
																<IconExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
															</a>
														);
													})}
												</div>
											)}
										</div>
									))}
								</div>
							</div>
						)}

						{copy.alerts.length > 0 && (
							<div>
								<div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-foreground">
									<IconAlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
									<span>{t("updates.alerts_title")}</span>
								</div>
								<div className="space-y-2">
									{copy.alerts.map((alert, idx) => (
										<a
											key={`${alert.url}-${idx}`}
											href={alert.url}
											target="_blank"
											rel="noopener noreferrer"
											className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-border bg-surface/40 px-3.5 py-2.5 hover:border-brand/50"
										>
											<div className="min-w-0 flex-1">
												<div className="flex flex-wrap items-center gap-2">
													<span
														className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold ${ALERT_STYLE[alert.kind] ?? ALERT_STYLE.beta}`}
													>
														{t(`updates.alert_kind_${alert.kind}`)}
													</span>
													<span className="text-xs font-semibold text-foreground">
														{alert.framework} · {alert.title}
													</span>
												</div>
												<p className="mt-1 text-xs text-subtle">{alert.note}</p>
											</div>
											<IconExternalLink
												className="mt-1 h-3.5 w-3.5 shrink-0 text-subtle"
												aria-hidden="true"
											/>
										</a>
									))}
								</div>
							</div>
						)}

						<div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-[11px] text-subtle">
							<span>
								{t("updates.digest_engine", {
									engine: shortModelLabel(active.provider, active.model, t),
								})}
							</span>
							<span>
								{t("updates.digest_generated_at", {
									time: (() => {
										const d = parseUTCDate(active.generated_at);
										return d
											? new Intl.DateTimeFormat(i18n.resolvedLanguage, {
													dateStyle: "medium",
													timeStyle: "short",
												}).format(d)
											: "—";
									})(),
								})}
							</span>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
