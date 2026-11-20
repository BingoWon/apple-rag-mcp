import { IconChevronRight, IconRefresh } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import TimeRangeSelector from "@/components/charts/TimeRangeSelector";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/Dialog";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { formatAdminDateTime } from "@/lib/admin-utils";
import { api } from "@/lib/api";
import {
	CLIENT_PAGE_SIZE,
	CLIENT_PRODUCTS,
	type ClientDetails,
	type ClientDimension,
	type ClientPeriod,
	type ClientReport,
	type ClientRow,
	clientPeriod,
} from "../../../shared/client-usage";
import { TOOL_KINDS } from "../../../shared/tool-activity";
import { TOOL_CHANNELS } from "../../../worker/shared/tool-channels";

function useClientStats<T>(url: string) {
	const [attempt, retry] = useState(0);
	const [result, set] = useState<{ url: string; attempt: number; data: T | null }>();
	useEffect(() => {
		const controller = new AbortController();
		api
			.get<T>(url, { signal: controller.signal })
			.then((r) => {
				if (!controller.signal.aborted)
					set({ url, attempt, data: r.success ? (r.data ?? null) : null });
			})
			.catch(() => {
				if (!controller.signal.aborted) set({ url, attempt, data: null });
			});
		return () => controller.abort();
	}, [url, attempt]);
	return {
		data: result?.url === url && result.attempt === attempt ? result.data : undefined,
		reload: () => retry((n) => n + 1),
	};
}

const environmentNames: Record<string, string> = {
	"darwin arm64": "macOS · ARM64",
	"darwin x64": "macOS · x64",
	"win32 x64": "Windows · x64",
	"win32 arm64": "Windows · ARM64",
	"linux x64": "Linux · x64",
	"linux arm64": "Linux · ARM64",
	"claude-vscode": "VS Code",
	"claude-desktop": "Claude Desktop",
	cli: "CLI",
	"sdk-cli": "Claude Agent SDK",
	"t3-code": "T3 Code",
};
function Breakdown({
	row,
	period,
	end,
	name,
}: {
	row: ClientRow;
	period: ClientPeriod;
	end: string;
	name: string;
}) {
	const { t, i18n } = useTranslation();
	const [dimension, setDimension] = useState<ClientDimension>(
		row.family === "apple_cli" || row.family === "codex" ? "version" : "environment",
	);
	const [page, setPage] = useState(1);
	const query = new URLSearchParams({
		period,
		end,
		channel: row.channel!,
		family: row.family!,
		dimension,
		page: String(page),
	});
	const { data, reload } = useClientStats<ClientDetails>(`/admin/clients/breakdown?${query}`);
	const number = (n: number) => n.toLocaleString(i18n.resolvedLanguage);
	return (
		<>
			<DialogHeader>
				<DialogTitle>{name}</DialogTitle>
				<DialogDescription>
					{t(`admin.channel_${row.channel}`)} · {t("activity.calls")} {number(row.calls)}
				</DialogDescription>
			</DialogHeader>
			<dl className="mb-5 grid grid-cols-2 gap-3 rounded-lg bg-secondary p-3 text-sm sm:grid-cols-3">
				{(
					[
						["accounts", row.accounts],
						["account_calls", row.account_calls],
						["other_calls", row.calls - row.account_calls],
						["ok", row.ok],
						["limited", row.limited],
						["other_status", row.calls - row.ok - row.limited],
					] as const
				).map(([key, n]) => (
					<div key={key}>
						<dt className="text-xs text-muted-foreground">{t(`client_stats.${key}`)}</dt>
						<dd className="font-semibold tabular-nums">{number(n)}</dd>
					</div>
				))}
			</dl>
			<div className="flex gap-2">
				{(["environment", "version"] as const).map((d) => (
					<Button
						key={d}
						size="sm"
						variant={dimension === d ? "primary" : "secondary"}
						aria-pressed={dimension === d}
						onClick={() => {
							setDimension(d);
							setPage(1);
						}}
					>
						{t(`client_stats.${d}`)}
					</Button>
				))}
			</div>
			{data === undefined ? (
				<p className="py-4 text-sm" role="status">
					{t("admin.stats_loading")}
				</p>
			) : data === null ? (
				<p className="py-4" role="alert">
					{t("admin.stats_unavailable")}{" "}
					<Button size="sm" onClick={reload}>
						{t("admin.stats_retry")}
					</Button>
				</p>
			) : (
				<>
					<table className="mt-3 w-full text-left text-sm">
						<thead>
							<tr className="border-b border-default text-xs text-muted-foreground">
								<th scope="col" className="py-2">
									{t(`client_stats.${dimension}`)}
								</th>
								<th scope="col" className="text-right">
									{t("activity.calls")}
								</th>
							</tr>
						</thead>
						<tbody>
							{data.rows.map((r) => {
								const source =
									r.label === "browser"
										? t("client_stats.browser")
										: r.label
											? (environmentNames[r.label] ?? r.label)
											: null;
								const value =
									dimension === "version"
										? [source, r.version ?? t("client_stats.not_reported")]
												.filter(Boolean)
												.join(" · ")
										: (source ?? t("client_stats.not_reported"));
								return (
									<tr
										key={JSON.stringify([r.label, r.version])}
										className="border-b border-default/60"
									>
										<td className="py-2 break-words">{value}</td>
										<td className="text-right tabular-nums">{number(r.calls)}</td>
									</tr>
								);
							})}
						</tbody>
					</table>
					{!data.total && (
						<p className="py-3 text-sm text-muted-foreground">{t("client_stats.empty")}</p>
					)}
					{data.total > CLIENT_PAGE_SIZE && (
						<PaginationControls
							currentPage={page}
							totalPages={Math.ceil(data.total / CLIENT_PAGE_SIZE)}
							total={data.total}
							pageSize={CLIENT_PAGE_SIZE}
							onPageChange={setPage}
							showPageSizeSelector={false}
						/>
					)}
				</>
			)}
		</>
	);
}

function ClientButton({ row, period, end }: { row: ClientRow; period: ClientPeriod; end: string }) {
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);
	const name = Object.hasOwn(CLIENT_PRODUCTS, row.family!)
		? CLIENT_PRODUCTS[row.family as keyof typeof CLIENT_PRODUCTS]
		: t(`client_stats.${row.family}`);
	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<button
					type="button"
					className="inline-flex min-h-9 items-center gap-1 text-left font-medium hover:text-brand focus-visible:outline-brand"
				>
					{name}
					<IconChevronRight className="size-3 shrink-0 text-muted-foreground" aria-hidden />
				</button>
			</DialogTrigger>
			{open && (
				<DialogContent>
					<Breakdown row={row} name={name} period={period} end={end} />
				</DialogContent>
			)}
		</Dialog>
	);
}

function ChannelTable({
	rows,
	period,
	end,
	total,
}: {
	rows: ClientRow[];
	period: ClientPeriod;
	end: string;
	total: number;
}) {
	const { t, i18n } = useTranslation();
	const formattedCount = (value: unknown) => Number(value).toLocaleString(i18n.resolvedLanguage);
	const columns: DataTableColumn<ClientRow>[] = [
		{
			key: "family",
			label: t("client_stats.client"),
			width: 210,
			render: (_, row) => <ClientButton key={end} row={row} period={period} end={end} />,
		},
		{ key: "calls", label: t("activity.calls"), width: 85, render: formattedCount },
		{
			key: "share",
			label: t("client_stats.share"),
			width: 104,
			render: (_, row) => (
				<div className="w-14 tabular-nums">
					{(row.calls / total).toLocaleString(i18n.resolvedLanguage, {
						style: "percent",
						maximumFractionDigits: 1,
					})}
					<div aria-hidden className="mt-1 h-1 rounded bg-secondary">
						<div
							className="h-full rounded bg-brand"
							style={{ width: `${(100 * row.calls) / total}%` }}
						/>
					</div>
				</div>
			),
		},
		{ key: "accounts", label: t("client_stats.accounts"), width: 120, render: formattedCount },
		...TOOL_KINDS.map((key) => ({
			key,
			label: t(`activity.${key}`),
			width: 90,
			render: formattedCount,
		})),
	];
	return (
		<Card>
			<DataTable columns={columns} data={rows} />
		</Card>
	);
}

export default function ClientsPage() {
	const { t, i18n } = useTranslation(),
		[params, setParams] = useSearchParams();
	const [sort, setSort] = useState<"calls" | "accounts">("calls");
	const period = clientPeriod.safeParse(params.get("period")).data ?? "7d";
	const select = (period: ClientPeriod) => setParams(period === "7d" ? {} : { period });
	const { data, reload } = useClientStats<ClientReport>(`/admin/clients?period=${period}`);
	const total = data?.rows.find((r) => r.channel === null);
	const families = data?.rows.filter((r) => r.family !== null) ?? [];
	const identified = families.reduce(
		(n, r) => n + (Object.hasOwn(CLIENT_PRODUCTS, r.family!) ? r.calls : 0),
		0,
	);
	const number = (n: number) => n.toLocaleString(i18n.resolvedLanguage);
	const percent = (n: number, d: number) =>
		d
			? (n / d).toLocaleString(i18n.resolvedLanguage, {
					style: "percent",
					maximumFractionDigits: 1,
				})
			: "—";
	return (
		<div className="mx-auto max-w-6xl space-y-5">
			<header className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-xl font-semibold">{t("client_stats.title")}</h1>
				<div className="flex flex-wrap items-center gap-2">
					<select
						aria-label={t("client_stats.sort")}
						className="h-9 rounded-md border border-default bg-card px-2 text-sm"
						value={sort}
						onChange={(e) => setSort(e.target.value === "accounts" ? "accounts" : "calls")}
					>
						<option value="calls">{t("client_stats.by_calls")}</option>
						<option value="accounts">{t("client_stats.by_accounts")}</option>
					</select>
					<TimeRangeSelector
						timeRange={period === "all" ? undefined : period}
						onTimeRangeChange={select}
					/>
					<Button
						size="sm"
						aria-pressed={period === "all"}
						variant={period === "all" ? "primary" : "secondary"}
						onClick={() => select("all")}
					>
						{t("client_stats.all")}
					</Button>
					<Button
						size="icon"
						variant="secondary"
						aria-label={t("admin.stats_refresh")}
						onClick={reload}
						disabled={data === undefined}
					>
						<IconRefresh className="size-4" />
					</Button>
				</div>
			</header>
			{data === undefined ? (
				<p role="status">{t("admin.stats_loading")}</p>
			) : !data || !total ? (
				<p role="alert">
					{t("admin.stats_unavailable")}{" "}
					<Button size="sm" onClick={reload}>
						{t("admin.stats_retry")}
					</Button>
				</p>
			) : (
				<>
					<p className="text-xs text-muted-foreground">
						{data.start ? formatAdminDateTime(data.start) : t("client_stats.all")} —{" "}
						{formatAdminDateTime(data.end)} · UTC+8
					</p>
					<Card className="grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
						{(
							[
								["calls", number(total.calls)],
								["identified", `${number(identified)} · ${percent(identified, total.calls)}`],
								["accounts", number(total.accounts)],
							] as const
						).map(([key, value]) => (
							<div key={key} className="px-4 py-3">
								<p className="text-xs text-muted-foreground">{t(`client_stats.${key}`)}</p>
								<p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
							</div>
						))}
					</Card>
					{TOOL_CHANNELS.map((channel) => {
						const channelRow = data.rows.find((r) => r.channel === channel && r.family === null);
						if (channel === "unknown" && !channelRow) return null;
						const rows = families
							.filter((r) => r.channel === channel)
							.sort((a, b) => b[sort] - a[sort] || b.calls - a.calls);
						return (
							<section
								key={channel}
								aria-label={t(`admin.channel_${channel}`)}
								className="space-y-2"
							>
								<div className="flex flex-wrap items-baseline gap-x-3">
									<h2 className="font-semibold">{t(`admin.channel_${channel}`)}</h2>
									<span className="text-sm text-muted-foreground">
										{t("activity.calls")} {number(channelRow?.calls ?? 0)} ·{" "}
										{t("client_stats.accounts")} {number(channelRow?.accounts ?? 0)}
									</span>
								</div>
								{channel === "cli" && (
									<p className="text-xs text-muted-foreground">{t("client_stats.cli_note")}</p>
								)}
								{rows.length ? (
									<ChannelTable
										rows={rows}
										period={period}
										end={data.end}
										total={channelRow!.calls}
									/>
								) : (
									<p className="rounded-lg border border-default p-4 text-sm text-muted-foreground">
										{t("client_stats.empty")}
									</p>
								)}
							</section>
						);
					})}
					<p className="text-xs leading-5 text-muted-foreground">{t("client_stats.method")}</p>
				</>
			)}
		</div>
	);
}
