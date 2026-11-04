import { IconAdjustmentsHorizontal, IconRefresh, IconSearch } from "@tabler/icons-react";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { useAdminLogs } from "@/hooks/useAdminLogs";
import { adminUserName } from "@/lib/admin-user";
import { formatAdminDateTime, formatAdminResponseTime } from "@/lib/admin-utils";
import type { AdminLog, AdminLogFilters, AdminLogKind } from "@/types/admin-logs";
import { TOOL_OUTCOMES } from "../../../worker/shared/tool-outcomes";
import { LogDetails } from "./LogDetails";
import { LogOutcome } from "./LogOutcome";

const fieldClass =
	"h-9 min-w-0 rounded-md border border-default bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-brand";
export function AdminLogs({ kind }: { kind: AdminLogKind }) {
	const { t } = useTranslation();
	const logs = useAdminLogs(kind);
	const [selected, setSelected] = useState<AdminLog | null>(null);
	const [rangeError, setRangeError] = useState(false);
	const detailTrigger = useRef<HTMLButtonElement | null>(null);
	const columns = useMemo<DataTableColumn<AdminLog>[]>(
		() => [
			{
				key: "created_at",
				label: `${t("admin.col_created")} · UTC+8`,
				width: 176,
				render: (value) => (
					<span className="whitespace-nowrap font-mono text-xs">
						{formatAdminDateTime(value as string)}
					</span>
				),
			},
			{
				key: kind === "fetch" ? "requested_url" : "requested_query",
				label: t(kind === "fetch" ? "admin.col_url" : "admin.col_query"),
				width: 400,
				render: (value, row) => (
					<button
						type="button"
						onClick={(event) => {
							detailTrigger.current = event.currentTarget;
							setSelected(row);
						}}
						className="block w-full min-w-0 rounded text-left text-sm text-brand hover:underline focus-visible:outline-2 focus-visible:outline-brand"
						aria-label={t("admin.open_log", { value: String(value || "—").slice(0, 120) })}
					>
						<span className="block truncate">{String(value || "—")}</span>
						<span className="mt-1 block truncate text-xs text-muted-foreground">
							{adminUserName(row.user, t)}
						</span>
					</button>
				),
			},
			{
				key: "channel",
				label: t("admin.col_channel"),
				width: 100,
				render: (_, row) => <Badge variant="outline">{t(`admin.channel_${row.channel}`)}</Badge>,
			},
			{
				key: "outcome",
				label: t("admin.col_outcome"),
				width: 130,
				render: (_, row) => <LogOutcome outcome={row.outcome} />,
			},
			{
				key: "response_time_ms",
				label: t("admin.col_time_s"),
				width: 90,
				render: (value) => (
					<span className="font-mono text-xs">
						{formatAdminResponseTime(value as number | null)}
					</span>
				),
			},
			...(kind === "fetch"
				? [
						{
							key: "content_source",
							label: t("admin.col_source"),
							width: 150,
							render: (_: unknown, row: AdminLog) => (
								<div>
									<span>{row.content_source ? t(`admin.source_${row.content_source}`) : "—"}</span>
									<span className="mt-1 block text-xs text-muted-foreground">
										{row.provider || "—"}
									</span>
								</div>
							),
						},
					]
				: [{ key: "result_count", label: t("admin.col_results"), width: 90 }]),
			{
				key: "details",
				label: t("admin.details"),
				width: 80,
				render: (_, row) => (
					<Button
						variant="secondary"
						size="sm"
						onClick={(event) => {
							detailTrigger.current = event.currentTarget;
							setSelected(row);
						}}
						aria-label={t("admin.open_log", {
							value: (row.requested_url || row.requested_query || row.id).slice(0, 120),
						})}
					>
						{t("admin.details")}
					</Button>
				),
			},
		],
		[kind, t],
	);
	const filters = logs.query.filters;
	const select = (name: string, label: string, options: { value: string; label: string }[]) => (
		<label className="min-w-0 space-y-1 text-xs text-muted-foreground">
			<span className="block">{label}</span>
			<select
				name={name}
				defaultValue={filters[name as keyof AdminLogFilters] || ""}
				className={`${fieldClass} w-full`}
			>
				<option value="">{t("admin.all")}</option>
				{options.map((o) => (
					<option key={o.value} value={o.value}>
						{o.label}
					</option>
				))}
			</select>
		</label>
	);
	return (
		<div className="min-w-0 space-y-4">
			<header className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h1 className="text-xl font-semibold tracking-tight">{t(`admin.${kind}_logs`)}</h1>
					<p className="mt-1 text-sm text-muted-foreground">{t("admin.log_list_desc")}</p>
					{(filters.from || filters.to) && (
						<p className="mt-1 text-xs text-muted-foreground">
							{t("admin.stats_exact_range", {
								start: filters.from ? formatAdminDateTime(filters.from) : "—",
								end: filters.to ? formatAdminDateTime(filters.to) : "—",
							})}
						</p>
					)}
				</div>
				<Button onClick={logs.refresh} disabled={logs.loading} variant="secondary" size="sm">
					<IconRefresh className="mr-1.5 h-4 w-4" />
					{t("common.refresh")}
				</Button>
			</header>
			<form
				key={JSON.stringify(filters)}
				className="space-y-3 rounded-xl border border-default bg-card p-4"
				onSubmit={(event) => {
					event.preventDefault();
					const form = new FormData(event.currentTarget);
					const values = Object.fromEntries(
						[...form]
							.filter(([, value]) => String(value).trim())
							.map(([key, value]) => [key, String(value).trim()]),
					);
					if (values.start && values.end && values.start > values.end) {
						setRangeError(true);
						return;
					}
					setRangeError(false);
					if (!values.start && !values.end) {
						if (filters.from) values.from = filters.from;
						if (filters.to) values.to = filters.to;
					}
					logs.apply(values);
				}}
			>
				<div className="flex flex-wrap items-end gap-3">
					<label className="min-w-48 flex-1 space-y-1 text-xs text-muted-foreground">
						<span className="block">{t("admin.search_logs_label")}</span>
						<div className="relative">
							<IconSearch className="pointer-events-none absolute left-3 top-2.5 h-4 w-4" />
							<input
								name="q"
								defaultValue={filters.q || ""}
								maxLength={2048}
								placeholder={t(
									kind === "fetch"
										? "admin.filter_url_placeholder"
										: "admin.filter_query_placeholder",
								)}
								className={`${fieldClass} w-full pl-9`}
							/>
						</div>
					</label>
					{select(
						"outcome",
						t("admin.col_outcome"),
						TOOL_OUTCOMES.map((value) => ({ value, label: t(`admin.stats_${value}`) })),
					)}
					<Button type="submit" size="sm" disabled={logs.loading}>
						{t("admin.apply_filters")}
					</Button>
					<Button
						type="button"
						size="sm"
						variant="ghost"
						onClick={() => {
							setRangeError(false);
							logs.apply({});
						}}
					>
						{t("admin.reset_filters")}
					</Button>
				</div>
				<details
					open={
						!!(
							filters.start ||
							filters.end ||
							filters.channel ||
							filters.reason ||
							filters.source ||
							filters.provider ||
							filters.cache
						)
					}
				>
					<summary className="w-fit cursor-pointer rounded text-xs text-muted-foreground focus-visible:outline-2 focus-visible:outline-brand">
						<IconAdjustmentsHorizontal className="mr-1 inline h-3.5 w-3.5" />
						{t("admin.more_filters")}
					</summary>
					<div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{select(
							"channel",
							t("admin.col_channel"),
							["mcp", "cli", "unknown"].map((value) => ({
								value,
								label: t(`admin.channel_${value}`),
							})),
						)}
						<label className="space-y-1 text-xs text-muted-foreground">
							<span className="block">{t("admin.col_reason")}</span>
							<input
								name="reason"
								defaultValue={filters.reason || ""}
								maxLength={100}
								placeholder="PAGE_NOT_FOUND"
								className={`${fieldClass} w-full`}
							/>
						</label>
						{kind === "fetch" && (
							<>
								{select(
									"source",
									t("admin.col_source"),
									["apple", "third_party"].map((value) => ({
										value,
										label: t(`admin.source_${value}`),
									})),
								)}
								{select(
									"provider",
									t("admin.col_provider"),
									["index", "apple_json", "apple_http", "firecrawl"].map((value) => ({
										value,
										label: value,
									})),
								)}
								{select(
									"cache",
									t("admin.col_cache"),
									["hit", "miss"].map((value) => ({ value, label: t(`admin.cache_${value}`) })),
								)}
							</>
						)}
						{(["start", "end"] as const).map((name) => (
							<label key={name} className="space-y-1 text-xs text-muted-foreground">
								<span className="block">
									{t(name === "start" ? "admin.stats_start_date" : "admin.stats_end_date")} · UTC+8
								</span>
								<input
									name={name}
									type="date"
									defaultValue={filters[name] || ""}
									className={`${fieldClass} w-full [color-scheme:light_dark]`}
								/>
							</label>
						))}
					</div>
				</details>
				{rangeError && (
					<p role="alert" className="text-sm text-error">
						{t("admin.log_date_range_error")}
					</p>
				)}
			</form>
			{logs.error && (
				<div
					role="alert"
					className="flex items-center justify-between gap-3 rounded-lg border border-error/30 p-3 text-sm text-error"
				>
					{t("admin.logs_load_failed")}
					<Button variant="secondary" size="sm" onClick={logs.refresh}>
						{t("admin.stats_retry")}
					</Button>
				</div>
			)}
			<Card className="min-w-0">
				{!logs.loading && !!logs.data?.logs.length && (
					<ul className="max-h-[65dvh] divide-y divide-border overflow-auto sm:hidden">
						{logs.data.logs.map((row) => (
							<li key={row.id}>
								<button
									type="button"
									className="block w-full min-w-0 space-y-2 p-4 text-left hover:bg-secondary focus-visible:outline-2 focus-visible:outline-brand"
									aria-label={t("admin.open_log", {
										value: (row.requested_url || row.requested_query || row.id).slice(0, 120),
									})}
									onClick={(event) => {
										detailTrigger.current = event.currentTarget;
										setSelected(row);
									}}
								>
									<span className="flex items-center justify-between gap-2">
										<span className="font-mono text-[11px] text-muted-foreground">
											{formatAdminDateTime(row.created_at)}
										</span>
										<span className="flex flex-wrap items-center gap-2">
											<Badge variant="outline">{t(`admin.channel_${row.channel}`)}</Badge>
											<LogOutcome outcome={row.outcome} />
										</span>
									</span>
									<span className="block truncate text-sm text-brand">
										{row.requested_url || row.requested_query || "—"}
									</span>
									<span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
										<span className="truncate">
											{kind === "fetch"
												? row.content_source
													? t(`admin.source_${row.content_source}`)
													: "—"
												: `${t("admin.col_results")}: ${row.result_count ?? 0}`}
										</span>
										<span>{formatAdminResponseTime(row.response_time_ms)}</span>
									</span>
								</button>
							</li>
						))}
					</ul>
				)}
				<div className={!logs.loading && logs.data?.logs.length ? "hidden sm:block" : ""}>
					<DataTable columns={columns} data={logs.data?.logs ?? []} isLoading={logs.loading} />
				</div>
				<PaginationControls
					currentPage={logs.query.page}
					totalPages={Math.ceil((logs.data?.total ?? 0) / logs.query.limit)}
					pageSize={logs.query.limit}
					total={logs.data?.total ?? 0}
					pageSizeOptions={[20, 50, 100]}
					onPageChange={logs.goToPage}
					onPageSizeChange={logs.changeLimit}
					isLoading={logs.loading}
				/>
			</Card>
			<LogDetails
				log={selected}
				kind={kind}
				onClose={() => setSelected(null)}
				onReturnFocus={() => detailTrigger.current?.focus()}
			/>
		</div>
	);
}
