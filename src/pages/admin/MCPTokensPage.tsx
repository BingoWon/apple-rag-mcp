/**
 * Admin MCP Tokens Page
 * Display and manage mcp_tokens table
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminUserLabel } from "@/components/admin/AdminUserLabel";
import { api } from "@/lib/api";
import type { AdminUserIdentity } from "../../../shared/admin-user";

interface AdminMCPToken {
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
			{ key: "mcp_token", label: t("admin.col_token"), width: 160 },
			{ key: "last_used_at", label: t("admin.col_last_used"), width: 160 },
			{ key: "created_at", label: t("admin.col_created"), width: 160 },
			{ key: "updated_at", label: t("admin.col_updated"), width: 160 },
		],
		[t],
	);
	const [tokens, setTokens] = useState<AdminMCPToken[]>([]);
	const [total, setTotal] = useState(0);
	const [limit, setLimit] = useState(50);
	const [currentPage, setCurrentPage] = useState(1);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchTokens = useCallback(
		async (page: number = 1) => {
			try {
				setIsLoading(true);
				setError(null);

				const response = await api.getAdminMCPTokens(page, limit);

				if (response.success && response.data) {
					const data = response.data as {
						tokens: AdminMCPToken[];
						total: number;
						limit: number;
						offset: number;
						hasMore: boolean;
					};
					setTokens(data.tokens || []);
					setTotal(data.total || 0);
					setLimit(data.limit || 50);
					setCurrentPage(page);
				} else {
					throw new Error("Failed to fetch MCP tokens data");
				}
			} catch (err) {
				console.error("Error fetching admin MCP tokens:", err);
				setError(err instanceof Error ? err.message : "Failed to load MCP tokens");
				setTokens([]);
				setTotal(0);
			} finally {
				setIsLoading(false);
			}
		},
		[limit],
	);

	const handlePageChange = (page: number) => {
		fetchTokens(page);
	};

	useEffect(() => {
		fetchTokens(1);
	}, [fetchTokens]);

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
				onRefresh={() => fetchTokens(currentPage)}
				onPageChange={handlePageChange}
			/>
		</div>
	);
}
