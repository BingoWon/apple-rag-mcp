import {
	IconArrowUpRight,
	IconCreditCard,
	IconDownload,
	IconKey,
	IconMessageCircle,
	IconSearch,
	IconUsers,
	IconWorld,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import type { AdminDashboardStats } from "@/types";
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

export function AdminStatsCards({
	stats,
	loading,
}: {
	stats: AdminDashboardStats | null;
	loading: boolean;
}) {
	const { t, i18n } = useTranslation();
	return (
		<div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4" aria-busy={loading}>
			{METRICS.map((section) => {
				const metric = stats?.metrics[section.key];
				const outcomes = metric?.outcomes;
				const isRequest = section.key === "searches" || section.key === "fetches";
				const Icon = section.icon;
				return (
					<Card key={section.key} className={`p-3 ${isRequest ? "xl:col-span-2" : ""}`}>
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
								title={t(isRequest ? "admin.stats_calls" : "admin.stats_new_records")}
							>
								{metric ? metric.total.toLocaleString(i18n.resolvedLanguage) : "--"}
							</span>
							<Link
								to={section.href}
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
								style={{ height: isRequest ? 145 : 48 }}
							>
								{t(loading ? "admin.stats_loading" : "admin.stats_unavailable")}
							</div>
						)}
						{outcomes && (
							<ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
								{(["success", "failed", "limited", "unknown"] as const)
									.filter((outcome) => outcome !== "unknown" || outcomes.unknown)
									.map((outcome) => (
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
			})}
			<Card className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 md:col-span-2 xl:col-span-4">
				<h3 className="flex items-center gap-2 text-sm font-semibold text-light">
					<IconCreditCard className="h-4 w-4 text-success" />
					{t("admin.stats_paid_users")}
					<span className="text-xs font-normal text-muted">{t("admin.stats_current")}</span>
				</h3>
				<span className="text-xl font-semibold tabular-nums text-light">
					{stats ? stats.subscriptions.total.toLocaleString(i18n.resolvedLanguage) : "--"}
				</span>
				<div className="ml-auto flex gap-4 text-xs text-muted">
					<span>
						Pro{" "}
						<strong className="ml-1 tabular-nums text-light">
							{stats?.subscriptions.pro ?? "--"}
						</strong>
					</span>
					<span>
						Enterprise{" "}
						<strong className="ml-1 tabular-nums text-light">
							{stats?.subscriptions.enterprise ?? "--"}
						</strong>
					</span>
				</div>
				<Link
					to="/admin/user-subscriptions"
					title={t("admin.stats_view_details")}
					aria-label={`${t("admin.subscriptions")}: ${t("admin.stats_view_details")}`}
					className="rounded p-1 text-muted hover:text-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
				>
					<IconArrowUpRight className="h-4 w-4" />
				</Link>
			</Card>
		</div>
	);
}
