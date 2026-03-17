/**
 * Admin Users Page
 * Display and manage users table
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminTable } from "@/components/admin/AdminTable";
import { api } from "@/lib/api";

interface AdminUser {
	id: string;
	email: string;
	name: string;
	provider?: string;
	avatar?: string;
	plan_type: string;
	subscription_status: string;
	last_login?: string;
	created_at: string;
	updated_at: string;
}

export default function AdminUsersPage() {
	const { t } = useTranslation();

	const columns = useMemo(
		() => [
			{ key: "id", label: t("admin.col_id"), width: "w-16" },
			{ key: "email", label: t("admin.col_email"), width: "w-64" },
			{ key: "name", label: t("admin.col_name"), width: "w-48" },
			{ key: "provider", label: t("admin.col_auth_provider"), width: "w-32" },
			{ key: "plan_type", label: t("admin.col_plan"), width: "w-24" },
			{ key: "subscription_status", label: t("admin.col_status"), width: "w-28" },
			{ key: "last_login", label: t("admin.col_last_login"), width: "w-40" },
			{ key: "created_at", label: t("admin.col_created"), width: "w-40" },
			{ key: "updated_at", label: t("admin.col_updated"), width: "w-40" },
		],
		[t],
	);
	const [users, setUsers] = useState<AdminUser[]>([]);
	const [total, setTotal] = useState(0);
	const [limit, setLimit] = useState(50);
	const [offset, setOffset] = useState(0);
	const [hasMore, setHasMore] = useState(false);
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
					setOffset(data.offset || 0);
					setHasMore(data.hasMore || false);
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
				offset={offset}
				hasMore={hasMore}
				currentPage={currentPage}
				isLoading={isLoading}
				error={error}
				onRefresh={() => fetchUsers(currentPage)}
				onPageChange={handlePageChange}
			/>
		</div>
	);
}
