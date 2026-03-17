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
import { Link } from "react-router-dom";

const adminSections = [
	{
		title: "Users",
		description: "Manage user accounts and profiles",
		href: "/admin/users",
		icon: IconUsers,
		color: "bg-brand",
	},
	{
		title: "MCP Tokens",
		description: "Monitor API tokens and usage",
		href: "/admin/mcp-tokens",
		icon: IconKey,
		color: "bg-brand-secondary",
	},
	{
		title: "Authorized IPs",
		description: "Manage IP address access control",
		href: "/admin/authorized-ips",
		icon: IconWorld,
		color: "bg-red-500",
	},
	{
		title: "Search Logs",
		description: "Track search operations and query activities",
		href: "/admin/search-logs",
		icon: IconSearch,
		color: "bg-orange-500",
	},
	{
		title: "Fetch Logs",
		description: "Track page fetch operations and content retrieval",
		href: "/admin/fetch-logs",
		icon: IconDownload,
		color: "bg-amber-500",
	},
	{
		title: "User Subscriptions",
		description: "Manage subscription plans and billing",
		href: "/admin/user-subscriptions",
		icon: IconCreditCard,
		color: "bg-green-500",
	},
	{
		title: "Contact Messages",
		description: "View user inquiries and feedback",
		href: "/admin/contact-messages",
		icon: IconMessageCircle,
		color: "bg-pink-500",
	},
];

export default function AdminDashboard() {
	return (
		<div className="space-y-6">
			{/* Page Header */}
			<div>
				<h2 className="text-2xl font-bold text-white">Admin Dashboard</h2>
				<p className="text-gray-400 mt-1">
					Administrative tools for managing the Apple RAG MCP system
				</p>
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
										{section.title}
									</h3>
									<p className="text-sm text-muted-foreground mt-1">{section.description}</p>
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
