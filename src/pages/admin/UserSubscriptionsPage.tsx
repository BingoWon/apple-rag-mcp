/**
 * Admin User Subscriptions Page
 * Display and manage user_subscriptions table
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminUserLabel } from "@/components/admin/AdminUserLabel";
import { Badge } from "@/components/ui/Badge";
import { formatAdminInterval } from "@/lib/admin-user";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type { AdminUserIdentity } from "../../../shared/admin-user";

interface AdminUserSubscription {
	user: AdminUserIdentity;
	plan_type: string;
	status: string;
	entitlement_source?: "free" | "stripe_subscription" | "one_time_pass" | "complimentary";
	is_stripe_managed?: boolean;
	current_period_start: string | null;
	current_period_end: string | null;
	cancel_at_period_end: boolean;
	price: number;
	currency: string | null;
	billing_interval: string;
	payment_type: string;
	updated_at: string;
}

function subscriptionStatusVariant(status: string) {
	switch (status) {
		case "active":
		case "trialing":
			return "success" as const;
		case "past_due":
		case "incomplete":
			return "warning" as const;
		default:
			return "secondary" as const;
	}
}

export default function AdminUserSubscriptionsPage() {
	const { t } = useTranslation();

	const columns = useMemo(
		() => [
			{
				key: "user",
				label: t("admin.col_user_name"),
				width: 224,
				render: (_value: unknown, row: AdminUserSubscription) => <AdminUserLabel user={row.user} />,
			},
			{
				key: "plan_type",
				label: t("admin.col_plan"),
				width: 96,
				render: (_: unknown, row: AdminUserSubscription) =>
					t(`plans.${row.plan_type}`, { defaultValue: row.plan_type }),
			},
			{
				key: "status",
				label: t("admin.col_status"),
				width: 120,
				render: (_: unknown, row: AdminUserSubscription) => (
					<Badge variant={subscriptionStatusVariant(row.status)}>
						{t(
							`billing.${row.status === "canceled" ? "cancelled" : row.status === "trialing" ? "trial" : row.status}`,
							{ defaultValue: row.status },
						)}
					</Badge>
				),
			},
			{
				key: "price",
				label: t("admin.col_price"),
				width: 128,
				render: (_value: unknown, row: AdminUserSubscription) => {
					const isComplimentary =
						row.entitlement_source === "complimentary" ||
						(row.plan_type !== "hobby" &&
							row.status === "active" &&
							row.price <= 0 &&
							!row.is_stripe_managed &&
							row.payment_type !== "one_time");
					if (isComplimentary) {
						return (
							<Badge variant="secondary" className="bg-brand/10 text-brand">
								{t("billing.complimentary")}
							</Badge>
						);
					}
					if (row.plan_type === "enterprise" && row.price <= 0) {
						return <span className="text-sm text-foreground">{t("plans.price_custom")}</span>;
					}
					if (row.plan_type === "hobby" && row.price <= 0) {
						return <span className="text-subtle italic">—</span>;
					}
					return formatCurrency(row.price, row.currency);
				},
			},
			{
				key: "billing_interval",
				label: t("admin.col_billing"),
				width: 120,
				render: (_: unknown, row: AdminUserSubscription) =>
					row.plan_type === "hobby" || row.entitlement_source === "complimentary"
						? "—"
						: formatAdminInterval(row.billing_interval, row.payment_type === "one_time", t),
			},
			{ key: "current_period_start", label: `${t("admin.col_period_start")} · UTC+8`, width: 176 },
			{ key: "current_period_end", label: `${t("admin.col_period_end")} · UTC+8`, width: 176 },
			{
				key: "cancel_at_period_end",
				label: t("admin.period_end_action"),
				width: 136,
				render: (_: unknown, row: AdminUserSubscription) => {
					if (row.entitlement_source === "complimentary") {
						return t("admin.manual_grant");
					}
					if (
						row.plan_type === "hobby" ||
						row.payment_type !== "subscription" ||
						!["active", "trialing", "past_due"].includes(row.status)
					)
						return "—";
					if (row.cancel_at_period_end) return t("billing.cancelled_at_end");
					return row.status === "past_due" ? t("billing.past_due") : t("admin.renews");
				},
			},
			{ key: "updated_at", label: `${t("admin.col_updated")} · UTC+8`, width: 176 },
		],
		[t],
	);
	const [subscriptions, setSubscriptions] = useState<AdminUserSubscription[]>([]);
	const [total, setTotal] = useState(0);
	const [limit, setLimit] = useState(50);
	const [currentPage, setCurrentPage] = useState(1);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const abortRef = useRef<AbortController | null>(null);

	const fetchSubscriptions = useCallback(
		async (page: number = 1, pageLimit: number = limit) => {
			abortRef.current?.abort();
			const controller = new AbortController();
			abortRef.current = controller;

			try {
				setIsLoading(true);
				setError(null);

				const response = await api.getAdminUserSubscriptions(page, pageLimit, controller.signal);
				if (controller.signal.aborted) return;

				if (response.success && response.data) {
					const data = response.data as {
						subscriptions: AdminUserSubscription[];
						total: number;
						limit: number;
						offset: number;
						hasMore: boolean;
					};
					const resolvedLimit = data.limit || pageLimit;
					const resolvedTotal = data.total || 0;
					const lastPage = Math.max(1, Math.ceil(resolvedTotal / resolvedLimit));
					if (page > lastPage) {
						void fetchSubscriptions(lastPage, resolvedLimit);
						return;
					}
					setSubscriptions(data.subscriptions || []);
					setTotal(resolvedTotal);
					setLimit(resolvedLimit);
					setCurrentPage(page);
				} else {
					throw new Error(t("admin.load_failed"));
				}
			} catch (err) {
				if (controller.signal.aborted) return;
				console.error("Error fetching admin user subscriptions:", err);
				setError(err instanceof Error ? err.message : t("admin.load_failed"));
				setSubscriptions([]);
				setTotal(0);
			} finally {
				if (!controller.signal.aborted) {
					setIsLoading(false);
				}
			}
		},
		[limit, t],
	);

	const handlePageChange = (page: number) => {
		void fetchSubscriptions(page, limit);
	};

	const handlePageSizeChange = (nextLimit: number) => {
		setCurrentPage(1);
		setLimit(nextLimit);
	};

	useEffect(() => {
		void fetchSubscriptions(1, limit);
		return () => {
			abortRef.current?.abort();
		};
	}, [fetchSubscriptions, limit]);

	return (
		<div className="flex h-full flex-col">
			<AdminTable
				title={t("admin.subscriptions_table")}
				description={t("admin.subscriptions_table_desc")}
				columns={columns}
				data={subscriptions}
				total={total}
				limit={limit}
				currentPage={currentPage}
				isLoading={isLoading}
				error={error}
				onRefresh={() => void fetchSubscriptions(currentPage, limit)}
				onPageChange={handlePageChange}
				onPageSizeChange={handlePageSizeChange}
			/>
		</div>
	);
}
