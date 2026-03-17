/**
 * Admin Dashboard Home
 * Overview of all admin functions and quick stats
 */

import {
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

const adminSections = [
	{
		titleKey: "admin.users",
		descKey: "admin.users_desc",
		href: "/admin/users",
		icon: IconUsers,
		color: "bg-brand",
	},
	{
		titleKey: "nav.mcp_tokens",
		descKey: "admin.mcp_tokens_desc",
		href: "/admin/mcp-tokens",
		icon: IconKey,
		color: "bg-brand-secondary",
	},
	{
		titleKey: "nav.authorized_ips",
		descKey: "admin.authorized_ips_desc",
		href: "/admin/authorized-ips",
		icon: IconWorld,
		color: "bg-red-500",
	},
	{
		titleKey: "admin.search_logs",
		descKey: "admin.search_logs_desc",
		href: "/admin/search-logs",
		icon: IconSearch,
		color: "bg-orange-500",
	},
	{
		titleKey: "admin.fetch_logs",
		descKey: "admin.fetch_logs_desc",
		href: "/admin/fetch-logs",
		icon: IconDownload,
		color: "bg-amber-500",
	},
	{
		titleKey: "admin.subscriptions",
		descKey: "admin.subscriptions_desc",
		href: "/admin/user-subscriptions",
		icon: IconCreditCard,
		color: "bg-green-500",
	},
	{
		titleKey: "admin.contact_messages",
		descKey: "admin.contact_messages_desc",
		href: "/admin/contact-messages",
		icon: IconMessageCircle,
		color: "bg-pink-500",
	},
];

export default function AdminDashboard() {
	const { t } = useTranslation();

	return (
		<div className="space-y-6">
			{/* Page Header */}
			<div>
				<h2 className="text-2xl font-bold text-white">{t("admin.dashboard")}</h2>
				<p className="text-gray-400 mt-1">{t("admin.dashboard_desc")}</p>
			</div>

			{/* Admin Sections Grid */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
				{adminSections.map((section) => {
					const IconComponent = section.icon;
					return (
						<Link
							key={section.href}
							to={section.href}
							className="group relative bg-card rounded-lg border border-border p-6 hover:bg-muted hover:shadow-lg transition-all"
						>
							<div className="flex items-center">
								<div className={`${section.color} rounded-lg p-3`}>
									<IconComponent className="h-6 w-6 text-white" />
								</div>
								<div className="ml-4">
									<h3 className="text-lg font-medium text-foreground group-hover:text-primary transition-colors">
										{t(section.titleKey)}
									</h3>
									<p className="text-sm text-muted-foreground mt-1">{t(section.descKey)}</p>
								</div>
							</div>
						</Link>
					);
				})}
			</div>

			{/* Quick Info */}
		</div>
	);
}
