/**
 * Admin Users Page
 * Display and manage users table
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminPlanBadge } from "@/components/admin/AdminUserLabel";
import { api } from "@/lib/api";
import type { AdminSubscription } from "../../../worker/shared/admin-user";

interface AdminUser {
	id: string;
	email: string;
	name: string;
	provider?: string;
	avatar?: string;
	plan_type: string;
	subscription_status: string;
	subscription: AdminSubscription;
	last_login?: string;
	created_at: string;
	updated_at: string;
}

export default function AdminUsersPage() {
	const { t } = useTranslation();

	const columns = useMemo(
		() => [
			{ key: "id", label: t("admin.col_id"), width: 64 },
			{ key: "email", label: t("admin.col_email"), width: 256 },
			{
				key: "name",
				label: t("admin.col_name"),
				width: 256,
				render: (_value: unknown, row: AdminUser) => (
					<div className="inline-flex flex-wrap items-center gap-1.5">
						<span>{row.name}</span>
						<AdminPlanBadge subscription={row.subscription} />
					</div>
				),
			},
			{ key: "provider", label: t("admin.col_auth_provider"), width: 128 },
			{ key: "subscription_status", label: t("admin.col_status"), width: 112 },
			{ key: "last_login", label: t("admin.col_last_login"), width: 160 },
			{ key: "created_at", label: t("admin.col_created"), width: 160 },
			{ key: "updated_at", label: t("admin.col_updated"), width: 160 },
		],
		[t],
	);
	const [users, setUsers] = useState<AdminUser[]>([]);
	const [total, setTotal] = useState(0);
	const [limit, setLimit] = useState(50);
	const [currentPage, setCurrentPage] = useState(1);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchUsers = useCallback(
		async (page: number = 1) => {
			try {
				setIsLoading(true);
				setError(null);

				const response = await api.getAdminUsers(page, limit);

				if (response.success && response.data) {
					const data = response.data as {
						users: AdminUser[];
						total: number;
						limit: number;
						offset: number;
						hasMore: boolean;
					};
					setUsers(data.users || []);
					setTotal(data.total || 0);
					setLimit(data.limit || 50);
					setCurrentPage(page);
				} else {
					throw new Error("Failed to fetch users data");
				}
			} catch (err) {
				console.error("Error fetching admin users:", err);
				setError(err instanceof Error ? err.message : "Failed to load users");
				setUsers([]);
				setTotal(0);
			} finally {
				setIsLoading(false);
			}
		},
		[limit],
	);

	const handlePageChange = (page: number) => {
		fetchUsers(page);
	};

	useEffect(() => {
		fetchUsers(1);
	}, [fetchUsers]);

	return (
		<div className="space-y-6">
			<AdminTable
				title={t("admin.users_table")}
				description={t("admin.users_table_desc")}
				columns={columns}
				data={users}
				total={total}
				limit={limit}
				currentPage={currentPage}
				isLoading={isLoading}
				error={error}
				onRefresh={() => fetchUsers(currentPage)}
				onPageChange={handlePageChange}
			/>
		</div>
	);
}
