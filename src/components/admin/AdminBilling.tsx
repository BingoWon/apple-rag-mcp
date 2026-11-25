import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/Card";
import { formatAdminDateTime } from "@/lib/admin-utils";
import type { AdminDashboardStats } from "@/types";
import { TrendChart } from "../charts/TrendChart";

export function AdminBilling({
	stats,
	loading,
}: {
	stats: AdminDashboardStats | null;
	loading: boolean;
}) {
	const { t, i18n } = useTranslation();
	const [selected, setSelected] = useState("USD");
	const billing = stats?.billing;
	const currencies = Object.keys(billing?.receipts ?? {}).sort();
	const currency = currencies.includes(selected) ? selected : (currencies[0] ?? "USD");
	const money = new Intl.NumberFormat(i18n.resolvedLanguage, { style: "currency", currency });
	const divisor = 10 ** (money.resolvedOptions().maximumFractionDigits ?? 2);
	const formatMoney = (value: number) => money.format(value / divisor);
	const formatCount = (value?: number) =>
		value !== undefined ? value.toLocaleString(i18n.resolvedLanguage) : "—";
	const ready = billing?.history_complete;
	const placeholderText = t(
		loading ? "admin.stats_loading" : billing ? "admin.billing_pending" : "admin.stats_unavailable",
	);
	const empty = { total: 0, points: [] };
	const revenue = billing?.receipts[currency] ?? empty;
	return (
		<section className="space-y-4">
			<div>
				<h2 className="text-lg font-semibold text-foreground">{t("admin.billing_title")}</h2>
				<p className="mt-1 text-xs leading-5 text-muted">{t("admin.billing_scope")}</p>
			</div>
			{billing?.synced_at && stats && (
				<p className="text-xs text-muted">
					{t(
						Date.parse(stats.generated_at) - Date.parse(billing.synced_at) > 25 * 3_600_000
							? "admin.billing_overdue"
							: "admin.billing_reconciled",
						{ date: formatAdminDateTime(billing.synced_at) },
					)}
				</p>
			)}
			{!ready && (
				<p role="status" className="rounded-lg border border-border px-4 py-3 text-sm text-muted">
					{t(
						loading
							? "admin.stats_loading"
							: billing
								? "admin.billing_pending"
								: "admin.stats_unavailable",
					)}
				</p>
			)}
			<div className="grid gap-4 lg:grid-cols-3">
				<Card className="min-w-0 p-5 lg:col-span-2">
					<div className="flex items-start justify-between gap-4">
						<div>
							<h3 className="text-sm text-muted">{t("admin.billing_receipts")}</h3>
							<p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
								{ready ? formatMoney(revenue.total) : "—"}
							</p>
						</div>
						<label className="text-xs text-muted">
							{t("admin.billing_currency")}
							<select
								value={currency}
								onChange={(e) => setSelected(e.target.value)}
								className="ml-2 rounded-md border border-border bg-card px-2 py-1.5 text-foreground"
							>
								{(currencies.length ? currencies : ["USD"]).map((code) => (
									<option key={code}>{code}</option>
								))}
							</select>
						</label>
					</div>
					{ready ? (
						<TrendChart
							metric={revenue}
							bucket={stats?.bucket ?? "day"}
							color="#3b82f6"
							height={260}
							formatValue={formatMoney}
							seriesName={t("admin.billing_receipts")}
						/>
					) : (
						<div className="flex h-[260px] items-center justify-center text-xs text-muted">
							{placeholderText}
						</div>
					)}
				</Card>
				<Card className="flex flex-col justify-between gap-6 p-5">
					<div>
						<h3 className="text-sm text-muted">{t("admin.stats_paid_users")}</h3>
						<p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
							{formatCount(stats?.subscriptions.total)}
						</p>
						<p className="mt-2 text-xs text-muted">
							{t("admin.stats_current")} · Pro {formatCount(stats?.subscriptions.pro)} · Enterprise{" "}
							{formatCount(stats?.subscriptions.enterprise)}
						</p>
					</div>
					<dl className="grid grid-cols-2 gap-4 border-t border-border pt-5">
						{(["new_subscribers", "renewing_subscribers"] as const).map((key) => (
							<div key={key}>
								<dt className="text-xs text-muted">{t(`admin.billing_${key}`)}</dt>
								<dd className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
									{ready ? billing[key].total.toLocaleString(i18n.resolvedLanguage) : "—"}
								</dd>
							</div>
						))}
					</dl>
					<p className="text-xs leading-5 text-muted">{t("admin.billing_people_note")}</p>
				</Card>
			</div>
			<Card className="p-5">
				<h3 className="text-sm font-medium text-foreground">{t("admin.billing_people_trend")}</h3>
				{ready ? (
					<TrendChart
						metric={{
							total: billing.new_subscribers.total + billing.renewing_subscribers.total,
							points: [],
						}}
						bucket={stats?.bucket ?? "day"}
						color="#3b82f6"
						height={200}
						comparison={[
							{
								name: t("admin.billing_new_subscribers"),
								color: "#3b82f6",
								metric: billing.new_subscribers,
							},
							{
								name: t("admin.billing_renewing_subscribers"),
								color: "#0d9488",
								metric: billing.renewing_subscribers,
							},
						]}
					/>
				) : (
					<div className="flex h-[200px] items-center justify-center text-xs text-muted">
						{placeholderText}
					</div>
				)}
			</Card>
		</section>
	);
}
