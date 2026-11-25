/**
 * Admin Authorized IPs Page
 * Display and manage authorized IP addresses across all users
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminUserLabel } from "@/components/admin/AdminUserLabel";
import { api } from "@/lib/api";
import type { AdminUserIdentity } from "../../../shared/admin-user";

interface AdminAuthorizedIP {
	id: string;
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
				render: (_value: unknown, row: AdminAuthorizedIP) => <AdminUserLabel user={row.user} />,
			},
			{ key: "name", label: t("admin.col_ip_name"), width: 192 },
			{
				key: "ip_address",
				label: t("admin.col_ip_address"),
				width: 184,
				render: (value: unknown) => (
					<span className="font-mono text-xs break-all">{String(value || "—")}</span>
				),
			},
			{ key: "last_used", label: `${t("admin.col_last_used")} · UTC+8`, width: 176 },
			{ key: "created_at", label: `${t("admin.col_created")} · UTC+8`, width: 176 },
			{ key: "updated_at", label: `${t("admin.col_updated")} · UTC+8`, width: 176 },
		],
		[t],
	);
	const [ips, setIPs] = useState<AdminAuthorizedIP[]>([]);
	const [total, setTotal] = useState(0);
	const [hasLoaded, setHasLoaded] = useState(false);
	const [limit, setLimit] = useState(50);
	const [currentPage, setCurrentPage] = useState(1);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const abortRef = useRef<AbortController | null>(null);

	const fetchIPs = useCallback(
		async (page: number = 1, pageLimit: number = limit) => {
			abortRef.current?.abort();
			const controller = new AbortController();
			abortRef.current = controller;

			try {
				setIsLoading(true);
				setError(null);

				const response = await api.getAdminAuthorizedIPs(page, pageLimit, controller.signal);
				if (controller.signal.aborted) return;

				if (response.success && response.data) {
					const data = response.data as {
						ips: AdminAuthorizedIP[];
						total: number;
						limit: number;
						offset: number;
						hasMore: boolean;
					};
					const resolvedLimit = data.limit || pageLimit;
					const resolvedTotal = data.total || 0;
					const lastPage = Math.max(1, Math.ceil(resolvedTotal / resolvedLimit));
					if (page > lastPage) {
						void fetchIPs(lastPage, resolvedLimit);
						return;
					}
					setIPs(data.ips || []);
					setTotal(resolvedTotal);
					setHasLoaded(true);
					setLimit(resolvedLimit);
					setCurrentPage(page);
				} else {
					setError(response.error?.message || t("admin.load_failed"));
				}
			} catch (err) {
				if (controller.signal.aborted) return;
				setError(err instanceof Error ? err.message : t("admin.load_failed"));
			} finally {
				if (!controller.signal.aborted) {
					setIsLoading(false);
				}
			}
		},
		[limit, t],
	);

	const handlePageChange = (page: number) => {
		void fetchIPs(page, limit);
	};

	const handlePageSizeChange = (nextLimit: number) => {
		setCurrentPage(1);
		setLimit(nextLimit);
	};

	useEffect(() => {
		void fetchIPs(1, limit);
		return () => {
			abortRef.current?.abort();
		};
	}, [fetchIPs, limit]);

	return (
		<div className="flex h-full flex-col">
			<AdminTable
				title={t("admin.authorized_ips_table")}
				description={
					hasLoaded
						? t("admin.authorized_ips_table_desc", { total })
						: t("admin.authorized_ips_desc_short")
				}
				columns={columns}
				data={ips}
				total={total}
				limit={limit}
				currentPage={currentPage}
				isLoading={isLoading}
				error={error}
				onRefresh={() => void fetchIPs(currentPage, limit)}
				onPageChange={handlePageChange}
				onPageSizeChange={handlePageSizeChange}
			/>
		</div>
	);
}
