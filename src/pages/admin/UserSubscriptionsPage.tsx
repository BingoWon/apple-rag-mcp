/**
 * Admin User Subscriptions Page
 * Display and manage user_subscriptions table
 */
import { useCallback, useEffect, useState } from "react";
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

const columns = [
	{ key: "user_id", label: "User ID", width: "w-16" },
	{ key: "user_email", label: "Email", width: "w-48" },
	{ key: "user_name", label: "Name", width: "w-40" },
	{ key: "plan_type", label: "Plan", width: "w-24" },
	{ key: "status", label: "Status", width: "w-28" },
	{ key: "price", label: "Price", width: "w-24" },
	{ key: "billing_interval", label: "Billing", width: "w-24" },
	{ key: "stripe_customer_id", label: "Stripe Customer", width: "w-28" },
	{
		key: "stripe_subscription_id",
		label: "Stripe Subscription",
		width: "w-28",
	},
	{ key: "stripe_price_id", label: "Stripe Price ID", width: "w-28" },
	{ key: "current_period_start", label: "Period Start", width: "w-36" },
	{ key: "current_period_end", label: "Period End", width: "w-36" },
	{ key: "cancel_at_period_end", label: "Cancel at End", width: "w-32" },
	{ key: "updated_at", label: "Updated", width: "w-40" },
];

export default function AdminUserSubscriptionsPage() {
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
				title="User Subscriptions Table"
				description="User subscription plans, billing periods, and Stripe integration data"
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
