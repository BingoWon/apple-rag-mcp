/**
 * Admin Authorized IPs Page
 * Display and manage authorized IP addresses across all users
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminTable } from "@/components/admin/AdminTable";
import { adminUserName } from "@/lib/admin-user";
import { api } from "@/lib/api";
import type { AdminUserIdentity } from "../../../worker/shared/admin-user";

interface AdminAuthorizedIP {
	user: AdminUserIdentity;
	name: string;
	ip_address: string;
	created_at: string;
	updated_at: string;
	last_used?: string;
}

export default function AdminAuthorizedIPsPage() {
	const { t } = useTranslation();

	const columns = useMemo(
		() => [
			{
				key: "user",
				label: t("admin.col_user_name"),
				width: 224,
				render: (_value: unknown, row: AdminAuthorizedIP) => adminUserName(row.user, t),
			},
			{ key: "name", label: t("admin.col_ip_name"), width: 192 },
			{ key: "ip_address", label: t("admin.col_ip_address"), width: 160 },
			{ key: "last_used", label: t("admin.col_last_used"), width: 160 },
			{ key: "created_at", label: t("admin.col_created"), width: 160 },
			{ key: "updated_at", label: t("admin.col_updated"), width: 160 },
		],
		[t],
	);
	const [ips, setIPs] = useState<AdminAuthorizedIP[]>([]);
	const [total, setTotal] = useState(0);
	const [limit, setLimit] = useState(50);
	const [currentPage, setCurrentPage] = useState(1);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchIPs = useCallback(
		async (page: number = 1) => {
			try {
				setIsLoading(true);
				setError(null);

				const response = await api.getAdminAuthorizedIPs(page, limit);

				if (response.success && response.data) {
					const data = response.data as {
						ips: AdminAuthorizedIP[];
						total: number;
						limit: number;
						offset: number;
						hasMore: boolean;
					};
					setIPs(data.ips || []);
					setTotal(data.total || 0);
					setLimit(data.limit || 50);
					setCurrentPage(page);
				} else {
					setError(response.error?.message || "Failed to fetch authorized IPs");
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to fetch authorized IPs");
			} finally {
				setIsLoading(false);
			}
		},
		[limit],
	);

	const handlePageChange = (page: number) => {
		fetchIPs(page);
	};

	useEffect(() => {
		fetchIPs(1);
	}, [fetchIPs]);

	// No need to format data - AdminTable will handle time formatting automatically

	return (
		<div className="space-y-6">
			<AdminTable
				title={t("admin.authorized_ips_table")}
				description={t("admin.authorized_ips_table_desc", { total })}
				columns={columns}
				data={ips}
				total={total}
				limit={limit}
				currentPage={currentPage}
				isLoading={isLoading}
				error={error}
				onRefresh={() => fetchIPs(currentPage)}
				onPageChange={handlePageChange}
			/>
		</div>
	);
}
