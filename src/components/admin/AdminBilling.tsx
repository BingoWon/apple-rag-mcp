import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { api } from "@/lib/api";
import type { AdminDashboardStats } from "@/types";
import { AdminTrendChart } from "./AdminTrendChart";

export function AdminBilling({
	stats,
	loading,
	onSynced,
}: {
	stats: AdminDashboardStats | null;
	loading: boolean;
	onSynced: () => void;
}) {
	const { t, i18n } = useTranslation();
	const [syncing, setSyncing] = useState(false);
	const [syncError, setSyncError] = useState<string | null>(null);
	const attempted = useRef(false);
	const sync = useCallback(async () => {
		attempted.current = true;
		setSyncing(true);
		setSyncError(null);
		try {
			let cursor: string | undefined;
			do {
				const result = await api.syncAdminBilling(cursor);
				if (!result.success || !result.data) {
					setSyncError(
						result.error?.code === "BILLING_NOT_CONFIGURED"
							? "admin.billing_configuration_error"
							: "admin.billing_sync_error",
					);
					return;
				}
				cursor = result.data.cursor ?? undefined;
			} while (cursor);
			onSynced();
		} catch {
			setSyncError("admin.billing_sync_error");
		} finally {
			setSyncing(false);
		}
	}, [onSynced]);
	const [selected, setSelected] = useState("USD");
	const billing = stats?.billing;
	useEffect(() => {
		if (billing && !billing.history_complete && !attempted.current) void sync();
	}, [billing, sync]);
	const currencies = Object.keys(billing?.receipts ?? {}).sort();
	const currency = currencies.includes(selected) ? selected : (currencies[0] ?? "USD");
	const money = new Intl.NumberFormat(i18n.resolvedLanguage, { style: "currency", currency });
	const divisor = 10 ** (money.resolvedOptions().maximumFractionDigits ?? 2);
	const formatMoney = (value: number) => money.format(value / divisor);
	const ready = billing?.history_complete;
	const empty = { total: 0, points: [] };
	const revenue = billing?.receipts[currency] ?? empty;
	return (
		<section className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<span className="text-xs text-muted">
					{stats?.billing.synced_at
						? t("admin.billing_synced", {
								date: new Intl.DateTimeFormat(i18n.resolvedLanguage, {
									dateStyle: "medium",
									timeStyle: "short",
									timeZone: "Asia/Singapore",
								}).format(new Date(stats.billing.synced_at)),
							})
						: t("admin.billing_not_synced")}
				</span>
				<Button size="sm" variant="secondary" disabled={loading || syncing} onClick={sync}>
					{t(syncing ? "admin.billing_syncing" : "admin.billing_sync")}
				</Button>
			</div>
			{syncError && (
				<p role="alert" className="text-sm text-error">
					{t(syncError)}
				</p>
			)}
			<div>
				<h2 className="text-lg font-semibold text-light">{t("admin.billing_title")}</h2>
				<p className="mt-1 text-xs leading-5 text-muted">{t("admin.billing_scope")}</p>
			</div>
			{!ready && !syncError && (
				<p role="status" className="rounded-lg border border-default px-4 py-3 text-sm text-muted">
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
							<p className="mt-2 text-3xl font-semibold tabular-nums text-light">
								{ready ? formatMoney(revenue.total) : "—"}
							</p>
						</div>
						<label className="text-xs text-muted">
							{t("admin.billing_currency")}
							<select
								value={currency}
								onChange={(e) => setSelected(e.target.value)}
								className="ml-2 rounded-md border border-default bg-card px-2 py-1.5 text-light"
							>
								{(currencies.length ? currencies : ["USD"]).map((code) => (
									<option key={code}>{code}</option>
								))}
							</select>
						</label>
					</div>
					{ready && (
						<AdminTrendChart
							metric={revenue}
							bucket={stats?.bucket ?? "day"}
							color="#3b82f6"
							height={260}
							formatValue={formatMoney}
							seriesName={t("admin.billing_receipts")}
						/>
					)}
				</Card>
				<Card className="flex flex-col justify-between gap-6 p-5">
					<div>
						<h3 className="text-sm text-muted">{t("admin.stats_paid_users")}</h3>
						<p className="mt-2 text-3xl font-semibold tabular-nums text-light">
							{stats?.subscriptions.total ?? "—"}
						</p>
						<p className="mt-2 text-xs text-muted">
							{t("admin.stats_current")} · Pro {stats?.subscriptions.pro ?? "—"} · Enterprise{" "}
							{stats?.subscriptions.enterprise ?? "—"}
						</p>
					</div>
					<dl className="grid grid-cols-2 gap-4 border-t border-default pt-5">
						{(["new_subscribers", "renewing_subscribers"] as const).map((key) => (
							<div key={key}>
								<dt className="text-xs text-muted">{t(`admin.billing_${key}`)}</dt>
								<dd className="mt-2 text-2xl font-semibold tabular-nums text-light">
									{ready ? billing[key].total.toLocaleString(i18n.resolvedLanguage) : "—"}
								</dd>
							</div>
						))}
					</dl>
					<p className="text-xs leading-5 text-muted">{t("admin.billing_people_note")}</p>
				</Card>
			</div>
			<Card className="p-5">
				<h3 className="text-sm font-medium text-light">{t("admin.billing_people_trend")}</h3>
				{ready && (
					<AdminTrendChart
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
				)}
			</Card>
		</section>
	);
}
