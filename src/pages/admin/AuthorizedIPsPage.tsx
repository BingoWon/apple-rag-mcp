/**
 * Admin Authorized IPs Page
 * Display and manage authorized IP addresses across all users
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminTable } from "@/components/admin/AdminTable";
import { api } from "@/lib/api";

interface AdminAuthorizedIP {
	user_id: string;
	user_email: string;
	user_name: string;
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
			{ key: "user_email", label: t("admin.col_user_email"), width: "w-64" },
			{ key: "user_name", label: t("admin.col_user_name"), width: "w-48" },
			{ key: "name", label: t("admin.col_ip_name"), width: "w-48" },
			{ key: "ip_address", label: t("admin.col_ip_address"), width: "w-40" },
			{ key: "last_used", label: t("admin.col_last_used"), width: "w-40" },
			{ key: "created_at", label: t("admin.col_created"), width: "w-40" },
			{ key: "updated_at", label: t("admin.col_updated"), width: "w-40" },
		],
		[t],
	);
	const [ips, setIPs] = useState<AdminAuthorizedIP[]>([]);
	const [total, setTotal] = useState(0);
	const [limit, setLimit] = useState(50);
	const [offset, setOffset] = useState(0);
	const [hasMore, setHasMore] = useState(false);
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
					setOffset(data.offset || 0);
					setHasMore(data.hasMore || false);
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
				offset={offset}
				hasMore={hasMore}
				currentPage={currentPage}
				isLoading={isLoading}
				error={error}
				onRefresh={() => fetchIPs(currentPage)}
				onPageChange={handlePageChange}
			/>
		</div>
	);
}
