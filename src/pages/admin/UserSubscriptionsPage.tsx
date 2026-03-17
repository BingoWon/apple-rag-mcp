/**
 * Admin User Subscriptions Page
 * Display and manage user_subscriptions table
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminTable } from "@/components/admin/AdminTable";
import { api } from "@/lib/api";

interface AdminUserSubscription {
	user_id: string;
	stripe_customer_id: string | null;
	stripe_subscription_id: string | null;
	plan_type: string;
	status: string;
	current_period_start: string | null;
	current_period_end: string | null;
	cancel_at_period_end: boolean;
	price: number;
	billing_interval: string;
	stripe_price_id: string | null;
	updated_at: string;
	// Joined user data for display
	user_email?: string;
	user_name?: string;
}

export default function AdminUserSubscriptionsPage() {
	const { t } = useTranslation();

	const columns = useMemo(
		() => [
			{ key: "user_id", label: t("admin.col_user_id"), width: "w-16" },
			{ key: "user_email", label: t("admin.col_email"), width: "w-48" },
			{ key: "user_name", label: t("admin.col_name"), width: "w-40" },
			{ key: "plan_type", label: t("admin.col_plan"), width: "w-24" },
			{ key: "status", label: t("admin.col_status"), width: "w-28" },
			{ key: "price", label: t("admin.col_price"), width: "w-24" },
			{ key: "billing_interval", label: t("admin.col_billing"), width: "w-24" },
			{ key: "stripe_customer_id", label: t("admin.col_stripe_customer"), width: "w-28" },
			{
				key: "stripe_subscription_id",
				label: t("admin.col_stripe_subscription"),
				width: "w-28",
			},
			{ key: "stripe_price_id", label: t("admin.col_stripe_price_id"), width: "w-28" },
			{ key: "current_period_start", label: t("admin.col_period_start"), width: "w-36" },
			{ key: "current_period_end", label: t("admin.col_period_end"), width: "w-36" },
			{ key: "cancel_at_period_end", label: t("admin.col_cancel_at_end"), width: "w-32" },
			{ key: "updated_at", label: t("admin.col_updated"), width: "w-40" },
		],
		[t],
	);
	const [subscriptions, setSubscriptions] = useState<AdminUserSubscription[]>([]);
	const [total, setTotal] = useState(0);
	const [limit, setLimit] = useState(50);
	const [offset, setOffset] = useState(0);
	const [hasMore, setHasMore] = useState(false);
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
					setOffset(data.offset || 0);
					setHasMore(data.hasMore || false);
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
				offset={offset}
				hasMore={hasMore}
				currentPage={currentPage}
				isLoading={isLoading}
				error={error}
				onRefresh={() => fetchSubscriptions(currentPage)}
				onPageChange={handlePageChange}
			/>
		</div>
	);
}
