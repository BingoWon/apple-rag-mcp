/**
 * Admin User Subscriptions Page
 * Display and manage user_subscriptions table
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminUserLabel } from "@/components/admin/AdminUserLabel";
import { api } from "@/lib/api";
import type { AdminUserIdentity } from "../../../worker/shared/admin-user";

interface AdminUserSubscription {
	user: AdminUserIdentity;
	plan_type: string;
	status: string;
	current_period_start: string | null;
	current_period_end: string | null;
	cancel_at_period_end: boolean;
	price: number;
	billing_interval: string;
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
			{ key: "plan_type", label: t("admin.col_plan"), width: 96 },
			{ key: "status", label: t("admin.col_status"), width: 112 },
			{ key: "price", label: t("admin.col_price"), width: 96 },
			{ key: "billing_interval", label: t("admin.col_billing"), width: 96 },
			{ key: "current_period_start", label: t("admin.col_period_start"), width: 144 },
			{ key: "current_period_end", label: t("admin.col_period_end"), width: 144 },
			{ key: "cancel_at_period_end", label: t("admin.col_cancel_at_end"), width: 128 },
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
		<div className="space-y-6">
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
