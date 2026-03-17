/**
 * Admin MCP Tokens Page
 * Display and manage mcp_tokens table
 */
import { useCallback, useEffect, useState } from "react";
import { AdminTable } from "@/components/admin/AdminTable";
import { api } from "@/lib/api";

interface AdminMCPToken {
	user_id: string;
	name: string;
	mcp_token: string;
	last_used_at: string | null;
	created_at: string;
	updated_at: string;
}

const columns = [
	{ key: "user_id", label: "User ID", width: "w-16" },
	{ key: "name", label: "Name", width: "w-48" },
	{ key: "mcp_token", label: "Token", width: "w-40" },
	{ key: "last_used_at", label: "Last Used", width: "w-40" },
	{ key: "created_at", label: "Created", width: "w-40" },
	{ key: "updated_at", label: "Updated", width: "w-40" },
];

export default function AdminMCPTokensPage() {
	const [tokens, setTokens] = useState<AdminMCPToken[]>([]);
	const [total, setTotal] = useState(0);
	const [limit, setLimit] = useState(50);
	const [offset, setOffset] = useState(0);
	const [hasMore, setHasMore] = useState(false);
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
					setOffset(data.offset || 0);
					setHasMore(data.hasMore || false);
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
		<div className="space-y-6">
			<AdminTable
				title="MCP Tokens Table"
				description="Model Context Protocol tokens for API access control"
				columns={columns}
				data={tokens}
				total={total}
				limit={limit}
				offset={offset}
				hasMore={hasMore}
				currentPage={currentPage}
				isLoading={isLoading}
				error={error}
				onRefresh={() => fetchTokens(currentPage)}
				onPageChange={handlePageChange}
			/>
		</div>
	);
}
