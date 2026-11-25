/**
 * Admin MCP Tokens Page
 * Display and manage mcp_tokens table
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminUserLabel } from "@/components/admin/AdminUserLabel";
import { api } from "@/lib/api";
import type { AdminUserIdentity } from "../../../shared/admin-user";

interface AdminMCPToken {
	id: string;
	user: AdminUserIdentity;
	name: string;
	mcp_token: string;
	last_used_at: string | null;
	created_at: string;
	updated_at: string;
}

export default function AdminMCPTokensPage() {
	const { t } = useTranslation();

	const columns = useMemo(
		() => [
			{
				key: "user",
				label: t("admin.col_user_name"),
				width: 224,
				render: (_value: unknown, row: AdminMCPToken) => <AdminUserLabel user={row.user} />,
			},
			{ key: "name", label: t("admin.col_name"), width: 192 },
			{ key: "mcp_token", label: t("admin.col_token"), width: 176 },
			{ key: "last_used_at", label: `${t("admin.col_last_used")} · UTC+8`, width: 176 },
			{ key: "created_at", label: `${t("admin.col_created")} · UTC+8`, width: 176 },
			{ key: "updated_at", label: `${t("admin.col_updated")} · UTC+8`, width: 176 },
		],
		[t],
	);
	const [tokens, setTokens] = useState<AdminMCPToken[]>([]);
	const [total, setTotal] = useState(0);
	const [limit, setLimit] = useState(50);
	const [currentPage, setCurrentPage] = useState(1);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const abortRef = useRef<AbortController | null>(null);

	const fetchTokens = useCallback(
		async (page: number = 1, pageLimit: number = limit) => {
			abortRef.current?.abort();
			const controller = new AbortController();
			abortRef.current = controller;

			try {
				setIsLoading(true);
				setError(null);

				const response = await api.getAdminMCPTokens(page, pageLimit, controller.signal);
				if (controller.signal.aborted) return;

				if (response.success && response.data) {
					const data = response.data as {
						tokens: AdminMCPToken[];
						total: number;
						limit: number;
						offset: number;
						hasMore: boolean;
					};
					const resolvedLimit = data.limit || pageLimit;
					const resolvedTotal = data.total || 0;
					const lastPage = Math.max(1, Math.ceil(resolvedTotal / resolvedLimit));
					if (page > lastPage) {
						void fetchTokens(lastPage, resolvedLimit);
						return;
					}
					setTokens(data.tokens || []);
					setTotal(resolvedTotal);
					setLimit(resolvedLimit);
					setCurrentPage(page);
				} else {
					throw new Error(t("admin.load_failed"));
				}
			} catch (err) {
				if (controller.signal.aborted) return;
				console.error("Error fetching admin MCP tokens:", err);
				setError(err instanceof Error ? err.message : t("admin.load_failed"));
				setTokens([]);
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
		void fetchTokens(page, limit);
	};

	const handlePageSizeChange = (nextLimit: number) => {
		setCurrentPage(1);
		setLimit(nextLimit);
	};

	useEffect(() => {
		void fetchTokens(1, limit);
		return () => {
			abortRef.current?.abort();
		};
	}, [fetchTokens, limit]);

	return (
		<div className="flex h-full flex-col">
			<AdminTable
				title={t("admin.mcp_tokens_table")}
				description={t("admin.mcp_tokens_table_desc")}
				columns={columns}
				data={tokens}
				total={total}
				limit={limit}
				currentPage={currentPage}
				isLoading={isLoading}
				error={error}
				onRefresh={() => void fetchTokens(currentPage, limit)}
				onPageChange={handlePageChange}
				onPageSizeChange={handlePageSizeChange}
			/>
		</div>
	);
}
