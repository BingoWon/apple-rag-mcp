import {
	IconArrowLeft,
	IconChartBar,
	IconCreditCard,
	IconDashboard,
	IconKey,
	IconLayoutSidebarLeftCollapse,
	IconLayoutSidebarLeftExpand,
	IconMessageCircle,
	IconSettings,
	IconWorld,
} from "@tabler/icons-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { Avatar } from "@/components/ui/OptimizedImage";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Sidebar, SidebarBody, SidebarLink, useSidebar } from "../ui/sidebar";

const SIDEBAR_LINK_KEYS = [
	{
		labelKey: "nav.overview",
		href: "/overview/",
		icon: <IconDashboard className="h-5 w-5 shrink-0" />,
	},
	{
		labelKey: "nav.mcp_tokens",
		href: "/mcp-tokens/",
		icon: <IconKey className="h-5 w-5 shrink-0" />,
	},
	{
		labelKey: "nav.authorized_ips",
		href: "/authorized-ips/",
		icon: <IconWorld className="h-5 w-5 shrink-0" />,
	},
	{
		labelKey: "nav.usage",
		href: "/usage/",
		icon: <IconChartBar className="h-5 w-5 shrink-0" />,
	},
	{
		labelKey: "nav.billing",
		href: "/billing/",
		icon: <IconCreditCard className="h-5 w-5 shrink-0" />,
	},
	{
		labelKey: "nav.messages",
		href: "/messages/",
		icon: <IconMessageCircle className="h-5 w-5 shrink-0" />,
	},
	{
		labelKey: "nav.settings",
		href: "/settings/",
		icon: <IconSettings className="h-5 w-5 shrink-0" />,
	},
] as const;

function SidebarHeader() {
	const { open, pinned, togglePin } = useSidebar();

	return (
		<div className={cn("flex items-center", open ? "justify-between" : "justify-center")}>
			{open ? <Logo /> : <LogoIcon />}
			{open && (
				<button
					type="button"
					onClick={togglePin}
					className={cn(
						"p-1.5 rounded-md transition-all duration-200",
						pinned
							? "text-brand hover:text-brand/80 bg-brand/10"
							: "text-muted hover:text-light hover:bg-secondary",
					)}
					title={pinned ? "Auto-collapse sidebar" : "Pin sidebar open"}
				>
					{pinned ? (
						<IconLayoutSidebarLeftCollapse className="h-4 w-4" />
					) : (
						<IconLayoutSidebarLeftExpand className="h-4 w-4" />
					)}
				</button>
			)}
		</div>
	);
}

function SidebarFooter({
	user,
}: {
	user: { name?: string; avatar?: string; email?: string } | null;
}) {
	const { t } = useTranslation();
	const { open } = useSidebar();

	const displayName = user?.name || t("common.user");

	if (!open) {
		return (
			<div className="flex flex-col items-center gap-3">
				<LanguageSwitcher placement="top" />
				<ThemeToggle variant="icon" placement="top" />
				<Link to="/settings" className="shrink-0">
					<Avatar src={user?.avatar} name={displayName} size="sm" className="h-7 w-7 shrink-0" />
				</Link>
			</div>
		);
	}

	return (
		<div className="flex items-center gap-2 px-2 py-2 rounded-lg">
			<Link to="/settings" className="shrink-0">
				<Avatar src={user?.avatar} name={displayName} size="sm" className="h-7 w-7 shrink-0" />
			</Link>
			<Link
				to="/settings"
				className="text-sm text-muted hover:text-light truncate flex-1 min-w-0 transition-colors duration-200"
			>
				{displayName}
			</Link>
			<div className="flex items-center shrink-0 ml-auto">
				<LanguageSwitcher placement="top" />
				<ThemeToggle variant="icon" placement="top" />
			</div>
		</div>
	);
}

const AppleSidebarComponent = ({ children }: { children: React.ReactNode }) => {
	const { t } = useTranslation();
	const { user, logout, isAuthenticated } = useAuth();
	const { pathname } = useLocation();
	const navigate = useNavigate();
	const [unreadCount, setUnreadCount] = useState(0);

	useEffect(() => {
		if (!isAuthenticated) {
			setUnreadCount(0);
			return;
		}

		const fetchUnreadCount = async () => {
			try {
				const response = await api.getUnreadReplies();
				if (response.success && response.data) {
					const data = response.data as { count?: number };
					setUnreadCount(data.count || 0);
				}
			} catch (error) {
				console.error("Failed to fetch unread count:", error);
			}
		};

		fetchUnreadCount();
		const interval = setInterval(fetchUnreadCount, 30000);
		return () => clearInterval(interval);
	}, [isAuthenticated]);

	const handleLogout = useCallback(async () => {
		try {
			logout();
			toast.success(t("nav.logout_success"));
			setTimeout(() => {
				navigate("/login");
			}, 100);
		} catch (error) {
			console.error("Logout error:", error);
			toast.error(t("nav.logout_error"));
		}
	}, [logout, navigate, t]);

	const links = useMemo(
		() => [
			...SIDEBAR_LINK_KEYS.map((link) => {
				const resolved = {
					label: t(link.labelKey),
					href: link.href,
					icon: link.icon,
				};
				if (link.href === "/messages/" && unreadCount > 0) {
					return {
						...resolved,
						badge: unreadCount > 9 ? "9+" : unreadCount.toString(),
					};
				}
				return resolved;
			}),
			{
				label: t("common.logout"),
				href: "#",
				icon: <IconArrowLeft className="h-5 w-5 shrink-0" />,
				onClick: handleLogout,
			},
		],
		[handleLogout, unreadCount, t],
	);

	const [open, setOpen] = useState(false);

	return (
		<div
			className={cn(
				"mx-auto flex w-full max-w-full flex-1 flex-col overflow-hidden rounded-md border border-default bg-secondary md:flex-row",
				"h-screen",
			)}
		>
			<Sidebar open={open} setOpen={setOpen}>
				<SidebarBody className="justify-between gap-10">
					<div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
						<SidebarHeader />
						<div className="mt-8 flex flex-col gap-2">
							{links.map((link, idx) => {
								const normalizedPathname = pathname?.replace(/\/$/, "") || "";
								const normalizedHref = link.href.replace(/\/$/, "");
								const isActive = normalizedPathname === normalizedHref;
								return <SidebarLink key={idx} link={link} isActive={isActive} />;
							})}
						</div>
					</div>
					<SidebarFooter user={user} />
				</SidebarBody>
			</Sidebar>
			<Dashboard>{children}</Dashboard>
		</div>
	);
};

export const Logo = () => {
	return (
		<Link
			to="/"
			className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal text-light"
		>
			<img
				src="/logo-with-text.svg"
				alt="Apple RAG MCP"
				width={160}
				height={32}
				className="h-8 w-auto"
			/>
		</Link>
	);
};

export const LogoIcon = () => {
	return (
		<Link
			to="/"
			className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal text-light"
		>
			<img src="/logo.svg" alt="Apple RAG MCP" width={32} height={32} className="h-8 shrink-0" />
		</Link>
	);
};

const Dashboard = React.memo(({ children }: { children: React.ReactNode }) => {
	return (
		<div className="flex flex-1 overflow-hidden">
			<div className="flex h-full w-full flex-1 flex-col gap-2 rounded-tl-2xl border border-default bg-background overflow-y-auto">
				<div className="mx-auto w-full max-w-7xl p-4 md:p-10">{children}</div>
			</div>
		</div>
	);
});

Dashboard.displayName = "Dashboard";

export const AppleSidebar = React.memo(AppleSidebarComponent);
AppleSidebar.displayName = "AppleSidebar";
