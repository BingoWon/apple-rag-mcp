/**
 * Admin User Subscriptions Page
 * Display and manage user_subscriptions table
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminUserLabel } from "@/components/admin/AdminUserLabel";
import { formatAdminInterval } from "@/lib/admin-user";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type { AdminUserIdentity } from "../../../shared/admin-user";

interface AdminUserSubscription {
	user: AdminUserIdentity;
	plan_type: string;
	status: string;
	current_period_start: string | null;
	current_period_end: string | null;
	cancel_at_period_end: boolean;
	price: number;
	currency: string | null;
	billing_interval: string;
	payment_type: string;
	updated_at: string;
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
				width: 112,
				render: (_: unknown, row: AdminUserSubscription) =>
					t(
						`billing.${row.status === "canceled" ? "cancelled" : row.status === "trialing" ? "trial" : row.status}`,
						{ defaultValue: row.status },
					),
			},
			{
				key: "price",
				label: t("admin.col_price"),
				width: 96,
				render: (_value: unknown, row: AdminUserSubscription) =>
					formatCurrency(row.price, row.currency),
			},
			{
				key: "billing_interval",
				label: t("admin.col_billing"),
				width: 116,
				render: (_: unknown, row: AdminUserSubscription) =>
					row.plan_type === "hobby"
						? "—"
						: formatAdminInterval(row.billing_interval, row.payment_type === "one_time", t),
			},
			{ key: "current_period_start", label: t("admin.col_period_start"), width: 144 },
			{ key: "current_period_end", label: t("admin.col_period_end"), width: 144 },
			{
				key: "cancel_at_period_end",
				label: t("admin.period_end_action"),
				width: 128,
				render: (_: unknown, row: AdminUserSubscription) => {
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
			{ key: "updated_at", label: t("admin.col_updated"), width: 160 },
		],
		[t],
	);
	const [subscriptions, setSubscriptions] = useState<AdminUserSubscription[]>([]);
	const [total, setTotal] = useState(0);
	const [limit, setLimit] = useState(50);
	const [currentPage, setCurrentPage] = useState(1);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchSubscriptions = useCallback(
		async (page: number = 1) => {
			try {
				setIsLoading(true);
				setError(null);

				const response = await api.getAdminUserSubscriptions(page, limit);

				if (response.success && response.data) {
					const data = response.data as {
						subscriptions: AdminUserSubscription[];
						total: number;
						limit: number;
						offset: number;
						hasMore: boolean;
					};
					setSubscriptions(data.subscriptions || []);
					setTotal(data.total || 0);
					setLimit(data.limit || 50);
					setCurrentPage(page);
				} else {
					throw new Error("Failed to fetch user subscriptions data");
				}
			} catch (err) {
				console.error("Error fetching admin user subscriptions:", err);
				setError(err instanceof Error ? err.message : "Failed to load user subscriptions");
				setSubscriptions([]);
				setTotal(0);
			} finally {
				setIsLoading(false);
			}
		},
		[limit],
	);

	const handlePageChange = (page: number) => {
		fetchSubscriptions(page);
	};

	useEffect(() => {
		fetchSubscriptions(1);
	}, [fetchSubscriptions]);

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
				onRefresh={() => fetchSubscriptions(currentPage)}
				onPageChange={handlePageChange}
			/>
		</div>
	);
}
