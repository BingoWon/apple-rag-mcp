/**
 * Admin Fetch Logs Page
 * Display and manage fetch_logs table
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminTable } from "@/components/admin/AdminTable";
import { api } from "@/lib/api";

interface AdminFetchLog {
	user_id: string;
	mcp_token: string | null;
	requested_url: string;
	actual_url: string;
	response_time_ms: number | null;
	status_code: number | null;
	reason: string | null;
	outcome: string;
	content_source: "apple" | "third_party" | null;
	provider: string | null;
	upstream_status: number | null;
	cache_hit: boolean;
	country_code: string | null;
	created_at: string;
}

export default function AdminFetchLogsPage() {
	const { t } = useTranslation();

	const columns = useMemo(
		() => [
			{ key: "user_id", label: t("admin.col_user_id"), width: "w-16" },
			{ key: "mcp_token", label: t("admin.col_token"), width: "w-16" },
			{
				key: "requested_url",
				label: t("admin.col_url"),
				width: "w-[400px]",
				render: (_: unknown, row: Record<string, unknown>) => {
					const requested = row.requested_url as string;
					const actual = row.actual_url as string;
					const isSame = requested === actual;

					return isSame ? (
						<div className="text-xs truncate" title={requested}>
							{requested}
						</div>
					) : (
						<div className="text-xs space-y-0.5">
							<div className="truncate" title={requested}>
								<span className="text-muted-foreground">→</span> {requested}
							</div>
							<div className="truncate text-muted-foreground" title={actual}>
								<span>⇢</span> {actual}
							</div>
						</div>
					);
				},
			},
			{ key: "response_time_ms", label: t("admin.col_time_s"), width: "w-24" },
			{
				key: "outcome",
				label: t("admin.col_outcome"),
				width: "w-28",
				render: (value: unknown) => t(`admin.stats_${value}`),
			},
			{ key: "status_code", label: t("admin.col_status"), width: "w-20" },
			{ key: "reason", label: t("admin.col_reason"), width: "w-32" },
			{
				key: "content_source",
				label: t("admin.col_source"),
				width: "w-28",
				render: (value: unknown) => (value ? t(`admin.source_${value}`) : "—"),
			},
			{ key: "provider", label: t("admin.col_provider"), width: "w-24" },
			{ key: "upstream_status", label: t("admin.col_upstream"), width: "w-20" },
			{
				key: "cache_hit",
				label: t("admin.col_cache"),
				width: "w-20",
				render: (value: unknown) => t(value ? "admin.cache_hit" : "admin.cache_miss"),
			},
			{ key: "country_code", label: "🌍", width: "w-12" },
			{ key: "created_at", label: t("admin.col_created"), width: "w-40" },
		],
		[t],
	);
	const [logs, setLogs] = useState<AdminFetchLog[]>([]);
	const [total, setTotal] = useState(0);
	const [limit, setLimit] = useState(50);
	const [offset, setOffset] = useState(0);
	const [hasMore, setHasMore] = useState(false);
	const [currentPage, setCurrentPage] = useState(1);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchLogs = useCallback(
		async (page: number = 1) => {
			try {
				setIsLoading(true);
				setError(null);

				const response = await api.getAdminFetchLogs(page, limit);

				if (response.success && response.data) {
					const data = response.data as {
						logs: AdminFetchLog[];
						total: number;
						limit: number;
						offset: number;
						hasMore: boolean;
					};
					setLogs(data.logs || []);
					setTotal(data.total || 0);
					setLimit(data.limit || 50);
					setOffset(data.offset || 0);
					setHasMore(data.hasMore || false);
					setCurrentPage(page);
				} else {
					throw new Error("Failed to fetch fetch logs data");
				}
			} catch (err) {
				console.error("Error fetching admin fetch logs:", err);
				setError(err instanceof Error ? err.message : "Failed to load fetch logs");
				setLogs([]);
				setTotal(0);
			} finally {
				setIsLoading(false);
			}
		},
		[limit],
	);

	const handlePageChange = (page: number) => {
		fetchLogs(page);
	};

	useEffect(() => {
		fetchLogs(1);
	}, [fetchLogs]);

	return (
		<div className="space-y-6">
			<AdminTable
				title={t("admin.fetch_logs_table")}
				description={t("admin.fetch_logs_table_desc")}
				columns={columns}
				data={logs}
				total={total}
				limit={limit}
				offset={offset}
				hasMore={hasMore}
				currentPage={currentPage}
				isLoading={isLoading}
				error={error}
				onRefresh={() => fetchLogs(currentPage)}
				onPageChange={handlePageChange}
			/>
		</div>
	);
}
