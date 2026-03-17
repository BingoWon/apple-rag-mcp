import { IconClipboard, IconClock, IconRefresh } from "@tabler/icons-react";
import { useCallback } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { DataTable, type DataTableColumn, DataTableRenderers } from "@/components/ui/DataTable";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { Tabs } from "@/components/ui/usage-tabs";
import { type PaginatedResponse, usePagination } from "@/hooks/usePagination";
import { api } from "@/lib/api";

interface UsageLog {
	id: string;
	query: string | null;
	result_count: number;
	status: "success" | "error";
	mcp_token: string | null;
	created_at: string;
	log_type: "search" | "fetch";
}

export default function UsagePage() {
	const { t } = useTranslation();

	// Create properly typed API call functions
	const fetchSearchLogs = useCallback(
		async (page: number, limit: number): Promise<PaginatedResponse<UsageLog>> => {
			const response = await api.getUsageSearchLogs(limit, page);
			return response as PaginatedResponse<UsageLog>;
		},
		[],
	);

	const fetchFetchLogs = useCallback(
		async (page: number, limit: number): Promise<PaginatedResponse<UsageLog>> => {
			const response = await api.getUsageFetchLogs(limit, page);
			return response as PaginatedResponse<UsageLog>;
		},
		[],
	);

	// Separate pagination for search and fetch logs
	const searchPagination = usePagination<UsageLog>(fetchSearchLogs, {
		initialPageSize: 20,
		pageSizeOptions: [20, 50, 100],
	});

	const fetchPagination = usePagination<UsageLog>(fetchFetchLogs, {
		initialPageSize: 20,
		pageSizeOptions: [20, 50, 100],
	});

	// Define columns for search logs
	const searchColumns: DataTableColumn[] = [
		{
			key: "mcp_token",
			label: t("usage.mcp_token"),
			render: (value) => (
				<div className="font-medium text-foreground text-sm">{value || t("usage.not_used")}</div>
			),
		},
		{
			key: "query",
			label: t("usage.query_text"),
			render: (value) => (
				<div className="text-foreground text-sm max-w-xs">
					{DataTableRenderers.truncateText(value || "", 50)}
				</div>
			),
		},
		{
			key: "result_count",
			label: t("usage.result_count"),
			render: (value) => <div className="text-muted-foreground text-sm">{value}</div>,
		},
		{
			key: "status",
			label: t("common.status"),
			render: (value) => DataTableRenderers.statusBadge(value === "success" ? 200 : 500),
		},
		{
			key: "created_at",
			label: t("usage.time"),
			render: (value) => (
				<div className="text-muted-foreground text-sm">{DataTableRenderers.formatDate(value)}</div>
			),
		},
	];

	// Define columns for fetch logs
	const fetchColumns: DataTableColumn[] = [
		{
			key: "mcp_token",
			label: t("usage.mcp_token"),
			render: (value) => (
				<div className="font-medium text-foreground text-sm">{value || t("usage.not_used")}</div>
			),
		},
		{
			key: "query",
			label: t("usage.url"),
			render: (value) => (
				<div className="text-foreground text-sm flex items-center gap-2">
					<span className="truncate cursor-default flex-1 min-w-0">
						{DataTableRenderers.truncateText(value || t("usage.no_url"), 100)}
					</span>
					{value && (
						<div className="flex-shrink-0">
							<Button
								size="icon"
								variant="ghost"
								onClick={async () => {
									try {
										await navigator.clipboard.writeText(value);
										toast.success(t("common.url_copied"));
									} catch (_error) {
										toast.error(t("common.copy_failed"));
									}
								}}
								title={t("common.copy_url")}
								className="text-muted hover:text-light h-8 w-8"
							>
								<IconClipboard className="h-4 w-4" />
							</Button>
						</div>
					)}
				</div>
			),
		},
		{
			key: "status",
			label: t("common.status"),
			render: (value) => DataTableRenderers.statusBadge(value === "success" ? 200 : 500),
		},
		{
			key: "created_at",
			label: t("usage.time"),
			render: (value) => (
				<div className="text-muted-foreground text-sm">{DataTableRenderers.formatDate(value)}</div>
			),
		},
	];

	const tabItems = [
		{
			id: "search",
			label: t("usage.search_logs"),
			badge: searchPagination.total,
			content: (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center justify-between">
							<div>
								<span>{t("usage.search_calls")}</span>
								<p className="text-sm text-muted-foreground mt-1 font-normal">
									{t("usage.search_calls_desc")}
								</p>
							</div>
							<div className="flex items-center gap-4">
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<IconClock className="h-4 w-4" />
									{t("common.last_updated", { time: new Date().toLocaleTimeString() })}
								</div>
								<Button
									variant="outline"
									size="sm"
									onClick={searchPagination.refresh}
									disabled={searchPagination.isLoading}
									className="flex items-center gap-2"
								>
									<IconRefresh className="h-4 w-4" />
									{t("common.refresh")}
								</Button>
							</div>
						</CardTitle>
					</CardHeader>
					<CardContent className="p-0">
						<DataTable
							columns={searchColumns}
							data={searchPagination.data}
							isLoading={searchPagination.isLoading}
							error={searchPagination.error}
						/>
						<PaginationControls
							currentPage={searchPagination.currentPage}
							totalPages={searchPagination.totalPages}
							pageSize={searchPagination.pageSize}
							total={searchPagination.total}
							pageSizeOptions={searchPagination.pageSizeOptions}
							onPageChange={searchPagination.goToPage}
							onPageSizeChange={searchPagination.changePageSize}
							isLoading={searchPagination.isLoading}
						/>
					</CardContent>
				</Card>
			),
		},
		{
			id: "fetch",
			label: t("usage.fetch_logs"),
			badge: fetchPagination.total,
			content: (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center justify-between">
							<div>
								<span>{t("usage.fetch_calls")}</span>
								<p className="text-sm text-muted-foreground mt-1 font-normal">
									{t("usage.fetch_calls_desc")}
								</p>
							</div>
							<div className="flex items-center gap-4">
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<IconClock className="h-4 w-4" />
									{t("common.last_updated", { time: new Date().toLocaleTimeString() })}
								</div>
								<Button
									variant="outline"
									size="sm"
									onClick={fetchPagination.refresh}
									disabled={fetchPagination.isLoading}
									className="flex items-center gap-2"
								>
									<IconRefresh className="h-4 w-4" />
									{t("common.refresh")}
								</Button>
							</div>
						</CardTitle>
					</CardHeader>
					<CardContent className="p-0">
						<DataTable
							columns={fetchColumns}
							data={fetchPagination.data}
							isLoading={fetchPagination.isLoading}
							error={fetchPagination.error}
						/>
						<PaginationControls
							currentPage={fetchPagination.currentPage}
							totalPages={fetchPagination.totalPages}
							pageSize={fetchPagination.pageSize}
							total={fetchPagination.total}
							pageSizeOptions={fetchPagination.pageSizeOptions}
							onPageChange={fetchPagination.goToPage}
							onPageSizeChange={fetchPagination.changePageSize}
							isLoading={fetchPagination.isLoading}
						/>
					</CardContent>
				</Card>
			),
		},
	];

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-2xl font-bold text-light">{t("usage.title")}</h1>
				<p className="mt-1 text-sm text-muted">{t("usage.subtitle")}</p>
			</div>

			{/* Error State */}
			{(searchPagination.error || fetchPagination.error) && (
				<div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
					<p className="text-destructive text-sm">
						{searchPagination.error || fetchPagination.error}
					</p>
				</div>
			)}

			{/* Tabbed Interface */}
			<Tabs items={tabItems} defaultTab="search" />
		</div>
	);
}
