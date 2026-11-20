import { IconClipboard, IconClock, IconRefresh } from "@tabler/icons-react";
import { useCallback } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
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
import { TOOL_KINDS, type ToolKind } from "../../../shared/tool-activity";

function useLogPage(kind: ToolKind, from?: string, to?: string) {
	const load = useCallback(
		async (page: number, limit: number) =>
			(await api.getUsageLogs(limit, page, kind, from, to)) as PaginatedApiResponse<UsageLog>,
		[kind, from, to],
	);
	return usePagination<UsageLog>(load, { initialPageSize: 20, pageSizeOptions: [20, 50, 100] });
}
export default function UsagePage() {
	const [params, update] = useSearchParams();
	const from = params.get("from") || undefined,
		to = params.get("to") || undefined;
	const kind = TOOL_KINDS.find((k) => k === params.get("tool")) ?? "search";
	return (
		<UsageContent
			key={JSON.stringify([from, to])}
			from={from}
			to={to}
			kind={kind}
			select={(v) => {
				const q = new URLSearchParams(params);
				q.set("tool", v);
				update(q);
			}}
		/>
	);
}
function UsageContent({
	from,
	to,
	kind,
	select,
}: {
	from?: string;
	to?: string;
	kind: ToolKind;
	select: (kind: string) => void;
}) {
	const { t, i18n } = useTranslation();
	const time = (v: string) =>
		new Date(v).toLocaleString(i18n.resolvedLanguage, {
			timeZone: "Asia/Singapore",
			hourCycle: "h23",
		});
	const pages = {
		search: useLogPage("search", from, to),
		browse: useLogPage("browse", from, to),
		fetch: useLogPage("fetch", from, to),
	};

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

	const tabItems = TOOL_KINDS.map((id) => {
		const pagination = pages[id];
		return {
			id,
			label: t(`activity.${id}`),
			badge: pagination.isLoading || pagination.error ? undefined : pagination.total,
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
		};
	});

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-2xl font-bold text-light">{t("usage.title")}</h1>
				<p className="mt-1 text-sm text-muted">{t("usage.subtitle")}</p>
			</div>

			{/* Tabbed Interface */}
			{(from || to) && (
				<div className="flex flex-wrap items-center gap-3 text-xs text-muted">
					<span>
						{from && to && Date.parse(from) < Date.parse(to)
							? `${time(from)} – ${time(to)} (UTC+8)`
							: t("admin.stats_range_error")}
					</span>
					<Link to={"/usage?tool=" + kind} className="text-brand">
						{t("activity.all_dates")}
					</Link>
				</div>
			)}
			<Tabs items={tabItems} activeTab={kind} onTabChange={select} />
		</div>
	);
}
