import { IconClipboard, IconClock, IconRefresh, IconSearch } from "@tabler/icons-react";
import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { DataTable, type DataTableColumn, DataTableRenderers } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Input";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { Tabs } from "@/components/ui/usage-tabs";
import { type PaginatedApiResponse, usePagination } from "@/hooks/usePagination";
import { api } from "@/lib/api";
import { formatDateTimeWithZone } from "@/lib/datetime";
import type { UsageLogItem as UsageLog } from "@/types";
import { copyText } from "@/utils/clipboard";
import { TOOL_KINDS, type ToolKind } from "../../../shared/tool-activity";

type StatusFilter = "all" | "success" | "error";

const APPLE_DOC_PREFIX = /^https?:\/\/developer\.apple\.com\/documentation\//i;

function formatBrowseTarget(raw: string | null | undefined, fallback: string): string {
	if (!raw) return fallback;
	const stripped = raw.replace(APPLE_DOC_PREFIX, "");
	return stripped || raw;
}

function formatLatency(ms: number | null | undefined): string {
	if (ms === null || ms === undefined || !Number.isFinite(ms)) return "—";
	if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
	return `${Math.round(ms)}ms`;
}

function useLogPage(
	kind: ToolKind,
	status: StatusFilter,
	search: string,
	from?: string,
	to?: string,
	invalidRange = false,
) {
	const load = useCallback(
		async (page: number, limit: number): Promise<PaginatedApiResponse<UsageLog>> => {
			if (invalidRange) {
				return {
					success: true,
					data: {
						items: [],
						pagination: {
							page: 1,
							limit,
							total: 0,
							total_pages: 0,
							has_next: false,
							has_prev: false,
						},
					},
				};
			}
			return (await api.getUsageLogs(
				limit,
				page,
				kind,
				from,
				to,
				status,
				search,
			)) as PaginatedApiResponse<UsageLog>;
		},
		[kind, status, search, from, to, invalidRange],
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
	const locale = i18n.resolvedLanguage ?? "en";
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
	const [searchInput, setSearchInput] = useState("");
	const [searchQuery, setSearchQuery] = useState("");

	const hasRangeParams = Boolean(from || to);
	const isValidRange = Boolean(
		from &&
			to &&
			Number.isFinite(Date.parse(from)) &&
			Number.isFinite(Date.parse(to)) &&
			Date.parse(from) < Date.parse(to),
	);
	const invalidRange = hasRangeParams && !isValidRange;

	const pages = {
		search: useLogPage("search", statusFilter, searchQuery, from, to, invalidRange),
		browse: useLogPage("browse", statusFilter, searchQuery, from, to, invalidRange),
		fetch: useLogPage("fetch", statusFilter, searchQuery, from, to, invalidRange),
	};

	const renderStatus = (value: unknown) =>
		DataTableRenderers.statusBadge(
			value === "success" ? 200 : 500,
			t("common.success"),
			t("common.error"),
		);

	const renderLatency = (value: unknown) => (
		<span className="font-mono text-xs tabular-nums text-subtle">
			{formatLatency(value as number | null)}
		</span>
	);

	const renderChannel = (value: unknown, row: UsageLog) => (
		<Badge variant="outline" title={row.credential_id || undefined}>
			{t(`admin.channel_${value}`)}
		</Badge>
	);

	const handleCopy = async (text: string) => {
		try {
			await copyText(text);
			toast.success(t("common.url_copied"));
		} catch {
			toast.error(t("common.copy_failed"));
		}
	};

	const searchColumns: DataTableColumn<UsageLog>[] = [
		{ key: "channel", label: t("admin.col_channel"), width: 100, render: renderChannel },
		{
			key: "query",
			label: t("usage.query_text"),
			width: 300,
			render: (value) => {
				const text = String(value || "");
				return (
					<div className="text-foreground text-sm max-w-xs truncate" title={text || undefined}>
						{DataTableRenderers.truncateText(text, 80)}
					</div>
				);
			},
		},
		{
			key: "result_count",
			label: t("usage.result_count"),
			width: 100,
			render: (value) => (
				<div className="text-subtle text-sm tabular-nums">{String(value ?? 0)}</div>
			),
		},
		{
			key: "response_time_ms",
			label: t("usage.latency"),
			width: 96,
			render: renderLatency,
		},
		{ key: "status", label: t("common.status"), width: 104, render: renderStatus },
		{
			key: "created_at",
			label: t("usage.time"),
			width: 184,
			render: (value) => (
				<div className="text-subtle text-xs whitespace-nowrap">
					{DataTableRenderers.formatDate(value as string)}
				</div>
			),
		},
	];

	const browseColumns: DataTableColumn<UsageLog>[] = [
		{ key: "channel", label: t("admin.col_channel"), width: 100, render: renderChannel },
		{
			key: "query",
			label: t("usage.topic_path"),
			width: 300,
			render: (value) => {
				const raw = value ? String(value) : "";
				const display = formatBrowseTarget(raw, t("usage.no_topic"));
				return (
					<div className="text-foreground text-sm flex items-center gap-2">
						<span className="truncate font-mono text-xs flex-1 min-w-0" title={raw || undefined}>
							{display}
						</span>
						{raw && (
							<Button
								size="icon"
								variant="ghost"
								onClick={() => void handleCopy(raw)}
								title={t("common.copy_url")}
								aria-label={t("common.copy_url")}
								className="text-muted hover:text-foreground h-7 w-7 shrink-0"
							>
								<IconClipboard className="h-3.5 w-3.5" />
							</Button>
						)}
					</div>
				);
			},
		},
		{
			key: "result_count",
			label: t("usage.items_returned"),
			width: 100,
			render: (value) => (
				<div className="text-subtle text-sm tabular-nums">{String(value ?? 0)}</div>
			),
		},
		{
			key: "response_time_ms",
			label: t("usage.latency"),
			width: 96,
			render: renderLatency,
		},
		{ key: "status", label: t("common.status"), width: 104, render: renderStatus },
		{
			key: "created_at",
			label: t("usage.time"),
			width: 184,
			render: (value) => (
				<div className="text-subtle text-xs whitespace-nowrap">
					{DataTableRenderers.formatDate(value as string)}
				</div>
			),
		},
	];

	const fetchColumns: DataTableColumn<UsageLog>[] = [
		{ key: "channel", label: t("admin.col_channel"), width: 100, render: renderChannel },
		{
			key: "query",
			label: t("usage.url"),
			width: 340,
			render: (value) => {
				const raw = value ? String(value) : "";
				return (
					<div className="text-foreground text-sm flex items-center gap-2">
						<span className="truncate flex-1 min-w-0" title={raw || undefined}>
							{DataTableRenderers.truncateText(raw || t("usage.no_url"), 100)}
						</span>
						{raw && (
							<Button
								size="icon"
								variant="ghost"
								onClick={() => void handleCopy(raw)}
								title={t("common.copy_url")}
								aria-label={t("common.copy_url")}
								className="text-muted hover:text-foreground h-7 w-7 shrink-0"
							>
								<IconClipboard className="h-3.5 w-3.5" />
							</Button>
						)}
					</div>
				);
			},
		},
		{
			key: "response_time_ms",
			label: t("usage.latency"),
			width: 96,
			render: renderLatency,
		},
		{ key: "status", label: t("common.status"), width: 104, render: renderStatus },
		{
			key: "created_at",
			label: t("usage.time"),
			width: 184,
			render: (value) => (
				<div className="text-subtle text-xs whitespace-nowrap">
					{DataTableRenderers.formatDate(value as string)}
				</div>
			),
		},
	];

	const columnsByKind: Record<ToolKind, DataTableColumn<UsageLog>[]> = {
		search: searchColumns,
		browse: browseColumns,
		fetch: fetchColumns,
	};

	const handleSearchSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setSearchQuery(searchInput.trim());
	};

	const tabItems = TOOL_KINDS.map((id) => {
		const pagination = pages[id];
		const updatedLabel = pagination.lastUpdatedAt
			? pagination.lastUpdatedAt.toLocaleTimeString(locale, {
					hour: "2-digit",
					minute: "2-digit",
					second: "2-digit",
					hour12: false,
				})
			: null;

		return {
			id,
			label: t(`activity.${id}`),
			badge:
				pagination.isLoading || pagination.error || invalidRange ? undefined : pagination.total,
			content: (
				<Card>
					<CardHeader className="space-y-4">
						<CardTitle className="flex flex-wrap items-start justify-between gap-3">
							<div>
								<span>{t(`usage.${id}_calls`)}</span>
								<p className="text-sm text-subtle mt-1 font-normal">
									{t(`usage.${id}_calls_desc`)}
								</p>
							</div>
							<div className="flex flex-wrap items-center gap-3">
								{updatedLabel && (
									<div className="flex items-center gap-1.5 text-xs font-normal text-subtle">
										<IconClock className="h-3.5 w-3.5" aria-hidden="true" />
										{t("common.last_updated", { time: updatedLabel })}
									</div>
								)}
								<Button
									variant="outline"
									size="sm"
									onClick={pagination.refresh}
									disabled={pagination.isLoading || invalidRange}
									className="flex items-center gap-2"
								>
									<IconRefresh className="h-4 w-4" aria-hidden="true" />
									{t("common.refresh")}
								</Button>
							</div>
						</CardTitle>

						<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
							<div className="flex flex-wrap items-center gap-1.5">
								{(["all", "success", "error"] as const).map((status) => (
									<Button
										key={status}
										size="sm"
										variant={statusFilter === status ? "primary" : "outline"}
										onClick={() => setStatusFilter(status)}
									>
										{t(`usage.filter_status_${status}`)}
									</Button>
								))}
							</div>
							<form
								onSubmit={handleSearchSubmit}
								className="flex items-center gap-2 w-full sm:w-auto"
							>
								<Input
									value={searchInput}
									onChange={(e) => setSearchInput(e.target.value)}
									placeholder={t("usage.search_placeholder")}
									className="h-9 sm:w-64"
								/>
								<Button type="submit" size="sm" variant="outline">
									<IconSearch className="h-4 w-4" aria-hidden="true" />
									<span className="sr-only">{t("common.search")}</span>
								</Button>
								{searchQuery && (
									<Button
										type="button"
										size="sm"
										variant="ghost"
										onClick={() => {
											setSearchInput("");
											setSearchQuery("");
										}}
									>
										{t("common.clear")}
									</Button>
								)}
							</form>
						</div>
					</CardHeader>
					<CardContent className="p-0">
						<DataTable
							columns={columnsByKind[id]}
							data={pagination.data}
							isLoading={pagination.isLoading}
							error={invalidRange ? t("usage.invalid_date_range") : pagination.error}
						/>
						{!invalidRange && !pagination.error && pagination.total > 0 && (
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
						)}
					</CardContent>
				</Card>
			),
		};
	});

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold text-foreground">{t("usage.title")}</h1>
				<p className="mt-1 text-sm text-muted">{t("usage.subtitle")}</p>
			</div>

			{hasRangeParams && (
				<div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-3.5 py-2 text-xs text-muted">
					<span>
						{isValidRange && from && to
							? `${formatDateTimeWithZone(from, locale)} – ${formatDateTimeWithZone(to, locale)}`
							: t("usage.invalid_date_range")}
					</span>
					<Link to={`/usage?tool=${kind}`} className="font-medium text-brand hover:underline">
						{t("activity.all_dates")}
					</Link>
				</div>
			)}
			<Tabs items={tabItems} activeTab={kind} onTabChange={select} />
		</div>
	);
}
