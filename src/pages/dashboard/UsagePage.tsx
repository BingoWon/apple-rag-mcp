import { IconClipboard, IconClock, IconRefresh } from "@tabler/icons-react";
import { useCallback } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { DataTable, type DataTableColumn, DataTableRenderers } from "@/components/ui/DataTable";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { Tabs } from "@/components/ui/usage-tabs";
import { type PaginatedApiResponse, usePagination } from "@/hooks/usePagination";
import { api } from "@/lib/api";
import type { UsageLogItem as UsageLog } from "@/types";
import { copyText } from "@/utils/clipboard";

function useLogPage(kind: "search" | "fetch" | "browse") {
	const load = useCallback(
		async (page: number, limit: number) =>
			(await api.getUsageLogs(limit, page, kind)) as PaginatedApiResponse<UsageLog>,
		[kind],
	);
	return usePagination<UsageLog>(load, { initialPageSize: 20, pageSizeOptions: [20, 50, 100] });
}
export default function UsagePage() {
	const { t } = useTranslation();
	const search = useLogPage("search"),
		fetchPage = useLogPage("fetch"),
		browse = useLogPage("browse");

	// Define columns for search logs
	const searchColumns: DataTableColumn<UsageLog>[] = [
		{
			key: "channel",
			label: t("admin.col_channel"),
			render: (value, row) => (
				<Badge variant="outline" title={row.credential_id || undefined}>
					{t(`admin.channel_${value}`)}
				</Badge>
			),
		},
		{
			key: "query",
			label: t("usage.query_text"),
			render: (value) => (
				<div className="text-foreground text-sm max-w-xs">
					{DataTableRenderers.truncateText(String(value || ""), 50)}
				</div>
			),
		},
		{
			key: "result_count",
			label: t("usage.result_count"),
			render: (value) => <div className="text-muted-foreground text-sm">{String(value)}</div>,
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
				<div className="text-muted-foreground text-sm">
					{DataTableRenderers.formatDate(value as string)}
				</div>
			),
		},
	];

	// Define columns for fetch logs
	const fetchColumns: DataTableColumn<UsageLog>[] = [
		{
			key: "channel",
			label: t("admin.col_channel"),
			render: (value, row) => (
				<Badge variant="outline" title={row.credential_id || undefined}>
					{t(`admin.channel_${value}`)}
				</Badge>
			),
		},
		{
			key: "query",
			label: t("usage.url"),
			render: (value) => (
				<div className="text-foreground text-sm flex items-center gap-2">
					<span className="truncate cursor-default flex-1 min-w-0">
						{DataTableRenderers.truncateText(String(value || t("usage.no_url")), 100)}
					</span>
					{!!value && (
						<div className="flex-shrink-0">
							<Button
								size="icon"
								variant="ghost"
								onClick={async () => {
									try {
										await copyText(String(value));
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
				<div className="text-muted-foreground text-sm">
					{DataTableRenderers.formatDate(value as string)}
				</div>
			),
		},
	];

	const tabItems = (
		[
			["search", search],
			["fetch", fetchPage],
			["browse", browse],
		] as const
	).map(([id, pagination]) => ({
		id,
		label: t(`usage.${id}_logs`),
		badge: pagination.total,
		content: (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center justify-between">
						<div>
							<span>{t(`usage.${id}_calls`)}</span>
							<p className="text-sm text-muted-foreground mt-1 font-normal">
								{t(`usage.${id}_calls_desc`)}
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
								onClick={pagination.refresh}
								disabled={pagination.isLoading}
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
						columns={id === "search" ? searchColumns : fetchColumns}
						data={pagination.data}
						isLoading={pagination.isLoading}
						error={pagination.error}
					/>
					<PaginationControls
						currentPage={pagination.currentPage}
						totalPages={pagination.totalPages}
						pageSize={pagination.pageSize}
						total={pagination.total}
						pageSizeOptions={pagination.pageSizeOptions}
						onPageChange={pagination.goToPage}
						onPageSizeChange={pagination.changePageSize}
						isLoading={pagination.isLoading}
					/>
				</CardContent>
			</Card>
		),
	}));

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-2xl font-bold text-light">{t("usage.title")}</h1>
				<p className="mt-1 text-sm text-muted">{t("usage.subtitle")}</p>
			</div>

			{/* Tabbed Interface */}
			<Tabs items={tabItems} defaultTab="search" />
		</div>
	);
}
