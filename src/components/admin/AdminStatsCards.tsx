import {
	IconActivity,
	IconArrowUpRight,
	IconDownload,
	IconKey,
	IconListTree,
	IconMessageCircle,
	IconSearch,
	IconTrendingUp,
	IconUserPlus,
	IconUsers,
	IconWorld,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import type { AdminDashboardStats, AdminMetricStats, AdminStatsQuery } from "@/types";
import { TOOL_CHANNELS, type ToolChannel } from "../../../worker/shared/tool-channels";
import { TOOL_OUTCOMES } from "../../../worker/shared/tool-outcomes";
import { AdminBilling } from "./AdminBilling";
import { AdminModelCosts } from "./AdminModelCosts";
import { AdminTrendChart, OUTCOME_COLORS } from "./AdminTrendChart";

const METRICS = [
	{
		key: "searches",
		title: "admin.search_logs",
		href: "/admin/search-logs",
		icon: IconSearch,
		color: "#2563eb",
	},
	{
		key: "fetches",
		title: "admin.fetch_logs",
		href: "/admin/fetch-logs",
		icon: IconDownload,
		color: "#0891b2",
	},
	{
		key: "browses",
		title: "admin.browse_logs",
		href: "/admin/browse-logs",
		icon: IconListTree,
		color: "#0f766e",
	},
	{ key: "users", title: "admin.users", href: "/admin/users", icon: IconUsers, color: "#2563eb" },
	{
		key: "tokens",
		title: "nav.mcp_tokens",
		href: "/admin/mcp-tokens",
		icon: IconKey,
		color: "#8b5cf6",
	},
	{
		key: "ips",
		title: "nav.authorized_ips",
		href: "/admin/authorized-ips",
		icon: IconWorld,
		color: "#0d9488",
	},
	{
		key: "messages",
		title: "admin.contact_messages",
		href: "/admin/contact-messages",
		icon: IconMessageCircle,
		color: "#db2777",
	},
] as const;

const CUMULATIVE_SIDES = [
	{ key: "registered", label: "admin.stats_registered", color: "#7c3aed" },
	{ key: "anonymous", label: "admin.stats_anonymous", color: "#f59e0b" },
] as const;

const CHANNEL_COLORS = { mcp: "#3b82f6", cli: "#0d9488", unknown: "#94a3b8" };

function ChannelUsageCard({
	stats,
	loading,
	channel,
	onChannelChange,
}: {
	stats: AdminDashboardStats | null;
	loading: boolean;
	channel?: ToolChannel;
	onChannelChange: (channel?: ToolChannel) => void;
}) {
	const { t, i18n } = useTranslation();
	const total = stats ? TOOL_CHANNELS.reduce((sum, key) => sum + stats.channels[key].total, 0) : 0;
	const visible = TOOL_CHANNELS.filter(
		(key) => key !== "unknown" || !!stats?.channels.unknown.total || channel === "unknown",
	);
	const format = (value: number) => value.toLocaleString(i18n.resolvedLanguage);
	const percent = new Intl.NumberFormat(i18n.resolvedLanguage, {
		style: "percent",
		maximumFractionDigits: 2,
	});
	return (
		<Card className="p-4 md:col-span-2 xl:col-span-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h3 className="flex items-center gap-2 text-sm font-medium text-light">
					<IconActivity className="h-4 w-4 text-brand" />
					{t("admin.stats_channels")}
					<span className="ml-1 text-xl font-semibold tabular-nums">
						{stats ? format(total) : "--"}
					</span>
				</h3>
				<label className="flex items-center gap-2 text-xs text-muted">
					{t("admin.col_channel")}
					<select
						value={channel ?? ""}
						onChange={(event) =>
							onChannelChange((event.target.value || undefined) as ToolChannel | undefined)
						}
						className="h-9 rounded-md border border-default bg-card px-3 text-sm text-light focus-visible:outline-2 focus-visible:outline-brand"
					>
						<option value="">{t("admin.all")}</option>
						{visible.map((key) => (
							<option key={key} value={key}>
								{t(`admin.channel_${key}`)}
							</option>
						))}
					</select>
				</label>
			</div>
			<p className="mt-2 text-xs leading-5 text-muted">{t("admin.stats_channels_note")}</p>
			{stats ? (
				<AdminTrendChart
					metric={{ total, points: [] }}
					bucket={stats.bucket}
					color={CHANNEL_COLORS.mcp}
					height={220}
					comparison={visible.map((key) => ({
						name: t(`admin.channel_${key}`),
						color: CHANNEL_COLORS[key],
						metric: stats.channels[key],
					}))}
				/>
			) : (
				<div className="flex h-55 items-center justify-center text-xs text-muted">
					{t(loading ? "admin.stats_loading" : "admin.stats_unavailable")}
				</div>
			)}
			<dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
				{visible.map((key) => (
					<div key={key} className="min-w-0">
						<dt className="flex items-center gap-1.5 text-xs text-muted">
							<span
								className="size-2 rounded-full"
								style={{ backgroundColor: CHANNEL_COLORS[key] }}
							/>
							{t(`admin.channel_${key}`)}
						</dt>
						<dd className="mt-1 text-lg font-semibold tabular-nums text-light">
							{stats ? format(stats.channels[key].total) : "--"}{" "}
							<span className="ml-2 text-xs font-normal text-muted">
								{stats ? percent.format(total ? stats.channels[key].total / total : 0) : "--"}
							</span>
						</dd>
					</div>
				))}
			</dl>
		</Card>
	);
}

function cumulativeSeries(
	metric: AdminMetricStats,
	key: (typeof CUMULATIVE_SIDES)[number]["key"],
): AdminMetricStats {
	return {
		total: metric.breakdown?.[key] ?? 0,
		points: metric.points.map((point) => ({ date: point.date, count: point[key] ?? 0 })),
	};
}

function CumulativeUsersCard({
	metric,
	bucket,
	loading,
}: {
	metric?: AdminMetricStats;
	bucket: "hour" | "day";
	loading: boolean;
}) {
	const { t, i18n } = useTranslation();
	const format = (value: number) => value.toLocaleString(i18n.resolvedLanguage);
	return (
		<Card className="p-4 md:col-span-2 xl:col-span-4">
			<div className="flex items-center gap-2">
				<IconTrendingUp className="h-4 w-4 shrink-0 text-[#7c3aed]" />
				<h3 className="min-w-0 flex-1 truncate text-sm font-medium text-light">
					{t("admin.stats_cumulative_users")}
				</h3>
				<span className="shrink-0 text-xl font-semibold tabular-nums text-light">
					{metric ? format(metric.total) : "--"}
				</span>
				<Link
					to="/admin/users"
					title={t("admin.stats_view_details")}
					aria-label={t("admin.stats_view_details")}
					className="shrink-0 rounded p-1 text-muted hover:text-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
				>
					<IconArrowUpRight className="h-4 w-4" />
				</Link>
			</div>
			<div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
				{CUMULATIVE_SIDES.map((side) => {
					const series = metric ? cumulativeSeries(metric, side.key) : undefined;
					return (
						<div key={side.key} className="min-w-0">
							<div className="mb-1 flex items-baseline justify-between gap-2">
								<h4 className="text-xs font-medium" style={{ color: side.color }}>
									{t(side.label)}
								</h4>
								<span className="text-sm font-semibold tabular-nums text-light">
									{series ? format(series.total) : "--"}
								</span>
							</div>
							{series ? (
								<AdminTrendChart
									metric={series}
									bucket={bucket}
									color={side.color}
									height={180}
									seriesName={t(side.label)}
									fitScale
								/>
							) : (
								<div
									className="flex items-center justify-center text-xs text-muted"
									style={{ height: 180 }}
								>
									{t(loading ? "admin.stats_loading" : "admin.stats_unavailable")}
								</div>
							)}
						</div>
					);
				})}
			</div>
			<p className="mt-2 text-xs text-muted">{t("admin.stats_cumulative_users_note")}</p>
		</Card>
	);
}

function AudienceCard({
	kind,
	metric,
	bucket,
	loading,
}: {
	kind: "new_users" | "active_users";
	metric?: AdminMetricStats;
	bucket: "hour" | "day";
	loading: boolean;
}) {
	const { t, i18n } = useTranslation();
	const isNew = kind === "new_users";
	const Icon = isNew ? IconUserPlus : IconActivity;
	const color = isNew ? "#2563eb" : "#0d9488";
	return (
		<Card className="p-4 md:col-span-2 xl:col-span-2">
			<div className="flex items-center gap-2">
				<Icon className="h-4 w-4 shrink-0" style={{ color }} />
				<h3 className="min-w-0 flex-1 truncate text-sm font-medium text-light">
					{t(isNew ? "admin.stats_new_users" : "admin.stats_active_users")}
				</h3>
				<span className="shrink-0 text-xl font-semibold tabular-nums text-light">
					{metric ? metric.total.toLocaleString(i18n.resolvedLanguage) : "--"}
				</span>
				<Link
					to={isNew ? "/admin/users" : "/admin/search-logs"}
					title={t("admin.stats_view_details")}
					aria-label={t("admin.stats_view_details")}
					className="shrink-0 rounded p-1 text-muted hover:text-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
				>
					<IconArrowUpRight className="h-4 w-4" />
				</Link>
			</div>
			{metric ? (
				<AdminTrendChart metric={metric} bucket={bucket} color={color} height={180} />
			) : (
				<div
					className="flex items-center justify-center text-xs text-muted"
					style={{ height: 180 }}
				>
					{t(loading ? "admin.stats_loading" : "admin.stats_unavailable")}
				</div>
			)}
			{isNew && metric?.breakdown && (
				<table className="mt-2 w-full text-xs">
					<thead>
						<tr className="text-left text-muted">
							<th className="pb-1 font-normal">{t("admin.stats_user_type")}</th>
							<th className="pb-1 text-right font-normal">{t("admin.stats_count")}</th>
						</tr>
					</thead>
					<tbody className="tabular-nums">
						{(
							[
								["registered", "admin.stats_registered"],
								["anonymous", "admin.stats_anonymous"],
							] as const
						).map(([key, label]) => (
							<tr key={key}>
								<td className="py-0.5">{t(label)}</td>
								<td className="py-0.5 text-right font-medium text-light">
									{metric.breakdown![key].toLocaleString(i18n.resolvedLanguage)}
								</td>
							</tr>
						))}
						<tr className="border-t border-default">
							<td className="pt-1 font-medium text-light">{t("admin.stats_total")}</td>
							<td className="pt-1 text-right font-semibold text-light">
								{metric.total.toLocaleString(i18n.resolvedLanguage)}
							</td>
						</tr>
					</tbody>
				</table>
			)}
			<p className="mt-2 text-xs text-muted">
				{t(isNew ? "admin.stats_new_users_note" : "admin.stats_active_users_note")}
			</p>
		</Card>
	);
}

export function AdminStatsCards({
	stats,
	loading,
	query,
	onChannelChange,
	onBillingSynced,
}: {
	stats: AdminDashboardStats | null;
	loading: boolean;
	query: AdminStatsQuery;
	onChannelChange: (channel?: ToolChannel) => void;
	onBillingSynced: () => void;
}) {
	const { t, i18n } = useTranslation();
	const detailQuery = new URLSearchParams({
		...(stats ? { from: stats.start, to: stats.end } : {}),
		...(query.channel ? { channel: query.channel } : {}),
	}).toString();
	return (
		<div className="space-y-8" aria-busy={loading}>
			<section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
				<h2 className="text-lg font-semibold text-light md:col-span-2 xl:col-span-4">
					{t("admin.audience_title")}
				</h2>
				<CumulativeUsersCard
					metric={stats?.metrics.cumulative_users}
					bucket={stats?.bucket ?? "day"}
					loading={loading}
				/>
				<AudienceCard
					kind="new_users"
					metric={stats?.metrics.new_users}
					bucket={stats?.bucket ?? "day"}
					loading={loading}
				/>
				<AudienceCard
					kind="active_users"
					metric={stats?.metrics.active_users}
					bucket={stats?.bucket ?? "day"}
					loading={loading}
				/>
			</section>
			<section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
				<h2 className="text-lg font-semibold text-light md:col-span-2 xl:col-span-4">
					{t("admin.usage_title")}
				</h2>
				<ChannelUsageCard
					stats={stats}
					loading={loading}
					channel={query.channel}
					onChannelChange={onChannelChange}
				/>
				{METRICS.filter((section) => ["browses", "searches", "fetches"].includes(section.key)).map(
					(section) => {
						const metric = stats?.metrics[section.key];
						const outcomes = metric?.outcomes;

						const Icon = section.icon;
						return (
							<Card key={section.key} className="p-4 xl:col-span-2">
								<div className="flex items-center gap-2">
									<Icon className="h-4 w-4 shrink-0" style={{ color: section.color }} />
									<h3
										className="min-w-0 flex-1 truncate text-sm font-medium text-light"
										title={t(section.title)}
									>
										{t(section.title)}
									</h3>
									<span
										className="shrink-0 text-xl font-semibold tabular-nums text-light"
										title={t("admin.stats_calls")}
									>
										{metric ? metric.total.toLocaleString(i18n.resolvedLanguage) : "--"}
									</span>
									<Link
										to={detailQuery ? `${section.href}?${detailQuery}` : section.href}
										title={t("admin.stats_view_details")}
										aria-label={`${t(section.title)}: ${t("admin.stats_view_details")}`}
										className="shrink-0 rounded p-1 text-muted hover:text-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
									>
										<IconArrowUpRight className="h-4 w-4" />
									</Link>
								</div>
								{metric && stats ? (
									<AdminTrendChart metric={metric} bucket={stats.bucket} color={section.color} />
								) : (
									<div
										className="flex items-center justify-center text-xs text-muted"
										style={{ height: 180 }}
									>
										{t(loading ? "admin.stats_loading" : "admin.stats_unavailable")}
									</div>
								)}
								{outcomes && (
									<ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
										{TOOL_OUTCOMES.filter(
											(outcome) => outcome === "success" || outcomes[outcome],
										).map((outcome) => (
											<li key={outcome} className="inline-flex items-center gap-1.5">
												<span
													className="h-2 w-2 rounded-full"
													style={{ backgroundColor: OUTCOME_COLORS[outcome] }}
												/>
												{t(`admin.stats_${outcome}`)}
												<span className="font-medium tabular-nums text-light">
													{outcomes[outcome].toLocaleString(i18n.resolvedLanguage)}
												</span>
											</li>
										))}
									</ul>
								)}
							</Card>
						);
					},
				)}
			</section>
			<AdminModelCosts stats={stats} channel={query.channel} loading={loading} />
			<AdminBilling stats={stats} loading={loading} onSynced={onBillingSynced} />
			<section>
				<h2 className="mb-4 text-lg font-semibold text-light">{t("admin.operations_title")}</h2>
				<Card className="grid divide-y divide-default sm:grid-cols-2 lg:grid-cols-5 lg:divide-x lg:divide-y-0">
					{[
						...METRICS.filter(
							(section) => !["browses", "searches", "fetches"].includes(section.key),
						),
						{
							key: "subscriptions",
							title: "admin.subscriptions",
							href: "/admin/user-subscriptions",
						},
					].map((item) => (
						<Link key={item.key} to={item.href} className="p-5 transition-colors hover:bg-hover">
							<span className="text-xs text-muted">{t(item.title)}</span>
							<p className="mt-2 text-2xl font-semibold tabular-nums text-light">
								{item.key === "subscriptions"
									? (stats?.subscriptions.total ?? "—")
									: (stats?.metrics[item.key as keyof AdminDashboardStats["metrics"]].total ?? "—")}
							</p>
							<p className="mt-1 text-xs text-muted">
								{t(
									item.key === "subscriptions" ? "admin.stats_current" : "admin.stats_new_records",
								)}
							</p>
						</Link>
					))}
				</Card>
			</section>
		</div>
	);
}
