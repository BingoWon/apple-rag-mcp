import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/Card";
import type { AdminDashboardStats, ModelCostCurrency } from "@/types";
import type { ToolChannel } from "../../../shared/tool-channels";
import { TrendChart } from "../charts/TrendChart";

const CATEGORIES = [
	{ key: "jev", color: "#7c3aed" },
	{ key: "microsoft_decision", color: "#c68121" },
	{ key: "embedding", color: "#60a5fa" },
	{ key: "reranking", color: "#0d9488" },
] as const;
const CURRENCIES = ["USD", "CNY"] as const;

export function AdminModelCosts({
	stats,
	channel,
	loading,
}: {
	stats: AdminDashboardStats | null;
	channel?: ToolChannel;
	loading: boolean;
}) {
	const { t, i18n } = useTranslation();
	const [selected, setSelected] = useState<ModelCostCurrency>("USD");
	const costs = stats?.model_costs;
	const currencies = CURRENCIES.flatMap((code) => {
		const values = costs?.currencies[code];
		return values ? [{ code, values }] : [];
	});
	const trend = currencies.find(({ code }) => code === selected) ?? currencies[0];
	const coverage = costs?.first_recorded_at;
	const recordingAvailable = stats && coverage && coverage < stats.end;
	const locale = i18n.resolvedLanguage;
	const formatMoney = (amount: number, code: ModelCostCurrency) => {
		if (!Number.isFinite(amount)) return "—";
		const value = amount / 1_000_000_000;
		const abs = Math.abs(value);
		const maximumFractionDigits =
			abs === 0 ? 2 : abs >= 1 ? 2 : abs >= 0.01 ? 4 : abs >= 0.0001 ? 6 : 8;
		return new Intl.NumberFormat(locale, {
			style: "currency",
			currency: code,
			currencyDisplay: "narrowSymbol",
			minimumFractionDigits: 2,
			maximumFractionDigits,
		}).format(value);
	};
	const cny = costs?.currencies.CNY?.total_nanos;
	const rate = costs?.exchange_rate;
	const usdEquivalent =
		cny != null && rate ? (costs?.currencies.USD?.total_nanos ?? 0) + cny / rate : null;
	const unpriced = CATEGORIES.reduce(
		(sum, { key }) => sum + (costs?.categories[key].unpriced_attempts ?? 0),
		0,
	);
	return (
		<section className="space-y-3">
			<h2 className="text-lg font-semibold text-foreground">{t("admin.model_cost_title")}</h2>
			<Card className="min-w-0 p-4 md:p-5">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h3 className="text-sm text-muted">{t("admin.model_cost_total")}</h3>
						{usdEquivalent !== null && (
							<p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
								≈ {formatMoney(usdEquivalent, "USD")}{" "}
								<span className="text-xs text-muted">USD</span>
							</p>
						)}
						<div
							className={`mt-1 flex flex-wrap gap-x-4 gap-y-1 tabular-nums ${usdEquivalent === null ? "text-2xl font-semibold text-foreground" : "text-sm text-muted"}`}
						>
							{currencies.map(({ code, values }) => (
								<span key={code}>
									{formatMoney(values.total_nanos, code)}{" "}
									<span className="text-xs font-medium text-muted">{code}</span>
								</span>
							))}
							{!currencies.length && "—"}
						</div>
					</div>
					{currencies.length > 1 && (
						<label className="flex items-center gap-2 text-xs text-muted">
							{t("admin.model_cost_chart_currency")}
							<select
								value={trend?.code}
								onChange={(event) => setSelected(event.target.value as ModelCostCurrency)}
								className="h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-brand"
							>
								{currencies.map(({ code }) => (
									<option key={code}>{code}</option>
								))}
							</select>
						</label>
					)}
				</div>
				<dl className="mt-4 grid gap-3 border-t border-border pt-4 grid-cols-2 lg:grid-cols-4">
					{CATEGORIES.map(({ key, color }) => {
						const attempts = costs?.categories[key].attempts;
						const amounts = currencies.flatMap(({ code, values }) => {
							const metric = values.categories[key];
							return metric.priced_attempts
								? [`${formatMoney(metric.total_nanos, code)} ${code}`]
								: [];
						});
						return (
							<div key={key}>
								<dt className="flex items-center gap-1.5 text-xs text-muted">
									<span className="size-2 rounded-full" style={{ backgroundColor: color }} />
									{t(`admin.model_cost_${key}`)}
								</dt>
								<dd className="mt-1 text-base font-semibold tabular-nums text-foreground">
									{amounts.length ? amounts.join(" · ") : "—"}
									{attempts !== undefined && recordingAvailable && (
										<span className="block text-xs font-normal text-muted">
											{t("admin.model_cost_calls", {
												count: attempts,
												formatted: attempts.toLocaleString(locale),
											})}
										</span>
									)}
								</dd>
							</div>
						);
					})}
				</dl>
				{stats && trend ? (
					<TrendChart
						metric={{ total: trend.values.total_nanos, points: [] }}
						bucket={stats.bucket}
						color={CATEGORIES[0].color}
						height={230}
						formatValue={(value) => formatMoney(value, trend.code)}
						stackComparison
						comparison={CATEGORIES.map(({ key, color }) => ({
							name: t(`admin.model_cost_${key}`),
							color,
							metric: trend.values.categories[key],
						}))}
					/>
				) : (
					<p className="py-8 text-center text-xs text-muted">
						{t(
							loading
								? "admin.stats_loading"
								: costs
									? "admin.model_cost_empty"
									: "admin.stats_unavailable",
						)}
					</p>
				)}
				<p className="mt-2 text-xs leading-5 text-muted">
					{t(channel ? "admin.model_cost_filtered" : "admin.model_cost_scope")}{" "}
					{t("admin.model_cost_basis")}
					{usdEquivalent !== null &&
						` ${t("admin.model_cost_rate", { rate: rate?.toLocaleString(locale, { maximumFractionDigits: 6 }) })}`}
					{coverage &&
						` ${t("admin.model_cost_coverage", {
							date: new Intl.DateTimeFormat(locale, {
								timeZone: "Asia/Singapore",
								dateStyle: "medium",
								timeStyle: "short",
							}).format(new Date(coverage)),
						})}`}
					{unpriced > 0 && ` ${t("admin.model_cost_unpriced", { count: unpriced })}`}
				</p>
			</Card>
		</section>
	);
}
