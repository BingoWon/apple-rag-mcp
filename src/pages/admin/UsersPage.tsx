/**
 * Admin Users Page
 * Display and manage users table
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminPlanBadge } from "@/components/admin/AdminUserLabel";
import { Badge } from "@/components/ui/Badge";
import { api } from "@/lib/api";
import type { AdminSubscription } from "../../../shared/admin-user";

interface AdminUser {
	id: string;
	email: string;
	name: string;
	provider?: string;
	avatar?: string;
	plan_type: string;
	subscription_status: string | null;
	subscription: AdminSubscription;
	last_login?: string;
	created_at: string;
	updated_at: string;
}

function statusBadgeVariant(status: string) {
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

export default function AdminUsersPage() {
	const { t } = useTranslation();

	const columns = useMemo(
		() => [
			{ key: "id", label: t("admin.col_id"), width: 128 },
			{ key: "email", label: t("admin.col_email"), width: 256 },
			{
				key: "name",
				label: t("admin.col_name"),
				width: 240,
				render: (_value: unknown, row: AdminUser) => (
					<div className="inline-flex flex-wrap items-center gap-1.5">
						<span>{row.name || t("admin.identity_registered")}</span>
						<AdminPlanBadge subscription={row.subscription} />
					</div>
				),
			},
			{
				key: "provider",
				label: t("admin.col_auth_provider"),
				width: 120,
				render: (value: unknown) => {
					const provider = String(value || "email").toLowerCase();
					return (
						<Badge variant="outline">
							{t(`settings.auth_method_${provider}`, { defaultValue: provider })}
						</Badge>
					);
				},
			},
			{
				key: "subscription_status",
				label: t("admin.col_status"),
				width: 120,
				render: (value: unknown) => {
					if (!value) return <span className="text-subtle italic">—</span>;
					const status = String(value);
					return (
						<Badge variant={statusBadgeVariant(status)}>
							{t(
								`billing.${status === "canceled" ? "cancelled" : status === "trialing" ? "trial" : status}`,
								{ defaultValue: status },
							)}
						</Badge>
					);
				},
			},
			{ key: "last_login", label: `${t("admin.col_last_login")} · UTC+8`, width: 176 },
			{ key: "created_at", label: `${t("admin.col_created")} · UTC+8`, width: 176 },
			{ key: "updated_at", label: `${t("admin.col_updated")} · UTC+8`, width: 176 },
		],
		[t],
	);
	const [users, setUsers] = useState<AdminUser[]>([]);
	const [total, setTotal] = useState(0);
	const [limit, setLimit] = useState(50);
	const [currentPage, setCurrentPage] = useState(1);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const abortRef = useRef<AbortController | null>(null);

	const fetchUsers = useCallback(
		async (page: number = 1, pageLimit: number = limit) => {
			abortRef.current?.abort();
			const controller = new AbortController();
			abortRef.current = controller;

			try {
				setIsLoading(true);
				setError(null);

				const response = await api.getAdminUsers(page, pageLimit, controller.signal);
				if (controller.signal.aborted) return;

				if (response.success && response.data) {
					const data = response.data as {
						users: AdminUser[];
						total: number;
						limit: number;
						offset: number;
						hasMore: boolean;
					};
					const resolvedLimit = data.limit || pageLimit;
					const resolvedTotal = data.total || 0;
					const lastPage = Math.max(1, Math.ceil(resolvedTotal / resolvedLimit));
					if (page > lastPage) {
						void fetchUsers(lastPage, resolvedLimit);
						return;
					}
					setUsers(data.users || []);
					setTotal(resolvedTotal);
					setLimit(resolvedLimit);
					setCurrentPage(page);
				} else {
					throw new Error(t("admin.load_failed"));
				}
			} catch (err) {
				if (controller.signal.aborted) return;
				console.error("Error fetching admin users:", err);
				setError(err instanceof Error ? err.message : t("admin.load_failed"));
				setUsers([]);
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
		void fetchUsers(page, limit);
	};

	const handlePageSizeChange = (nextLimit: number) => {
		setCurrentPage(1);
		setLimit(nextLimit);
	};

	useEffect(() => {
		void fetchUsers(1, limit);
		return () => {
			abortRef.current?.abort();
		};
	}, [fetchUsers, limit]);

	return (
		<div className="flex h-full flex-col">
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
				onRefresh={() => void fetchUsers(currentPage, limit)}
				onPageChange={handlePageChange}
				onPageSizeChange={handlePageSizeChange}
			/>
		</div>
	);
}
