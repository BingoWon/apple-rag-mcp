import "./admin-layout.css";
import { IconHome, IconLayoutDashboard } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Outlet, useLocation } from "react-router-dom";
import { AdminAuth } from "@/components/admin/AdminAuth";
import { RouteErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/Button";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { LoaderFive } from "@/components/ui/loader";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ADMIN_SESSION_KEY } from "@/lib/constants";
import { TOOL_KINDS } from "../../../shared/tool-activity";

const adminNavItems = [
	{ href: "/admin", labelKey: "nav.overview", exact: true },
	{ href: "/admin/clients", labelKey: "client_stats.title", exact: false },
	{ href: "/admin/users", labelKey: "admin.users", exact: false },
	{ href: "/admin/mcp-tokens", labelKey: "nav.mcp_tokens", exact: false },
	{ href: "/admin/authorized-ips", labelKey: "nav.authorized_ips", exact: false },
	...TOOL_KINDS.map((tool) => ({
		href: `/admin/${tool}-logs`,
		labelKey: `admin.${tool}_logs`,
		exact: false,
	})),
	{ href: "/admin/user-subscriptions", labelKey: "admin.subscriptions", exact: false },
	{ href: "/admin/contact-messages", labelKey: "admin.contact_messages", exact: false },
];

export function AdminLayout() {
	const { t } = useTranslation();
	const { pathname } = useLocation();
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const adminPassword = localStorage.getItem(ADMIN_SESSION_KEY);
		setIsAuthenticated(!!adminPassword);
		setIsLoading(false);

		const handleAuthExpired = () => {
			setIsAuthenticated(false);
		};
		const handleStorage = (event: StorageEvent) => {
			if (event.key === ADMIN_SESSION_KEY) {
				setIsAuthenticated(Boolean(event.newValue));
			}
		};

		window.addEventListener("admin-auth-expired", handleAuthExpired);
		window.addEventListener("storage", handleStorage);
		return () => {
			window.removeEventListener("admin-auth-expired", handleAuthExpired);
			window.removeEventListener("storage", handleStorage);
		};
	}, []);

	if (isLoading) {
		return (
			<div className="min-h-dvh bg-background flex items-center justify-center">
				<LoaderFive text={t("admin.loading")} />
			</div>
		);
	}

	if (!isAuthenticated) {
		return <AdminAuth onAuthenticated={() => setIsAuthenticated(true)} />;
	}

	return (
		<div className="admin-layout min-h-dvh bg-background">
			<header className="bg-card shadow-sm border-b border-border">
				<div className="mx-auto flex min-h-12 items-center gap-3 px-4 sm:px-6 lg:px-8">
					<nav
						aria-label={t("admin.title")}
						className="flex min-w-0 flex-1 gap-4 overflow-x-auto sm:gap-6"
					>
						{adminNavItems.map((item) => {
							const normalizedPathname = pathname.replace(/\/$/, "") || "/";
							const normalizedHref = item.href.replace(/\/$/, "") || "/";
							const exactMatch = normalizedPathname === normalizedHref;
							const prefixMatchResult =
								normalizedPathname.startsWith(normalizedHref) && normalizedHref !== "/admin";
							const isActive = item.exact ? exactMatch : prefixMatchResult;

							return (
								<Link
									key={item.href}
									to={item.href}
									className={`shrink-0 whitespace-nowrap border-b-2 py-2.5 px-1 text-sm font-medium transition-colors ${
										isActive
											? "border-brand text-brand bg-brand/10"
											: "border-transparent text-subtle hover:text-foreground hover:border-border-strong"
									}`}
								>
									{t(item.labelKey)}
								</Link>
							);
						})}
					</nav>
					<div className="flex shrink-0 items-center gap-2">
						<LanguageSwitcher />
						<ThemeToggle />
						<Button asChild variant="outline" size="sm" className="h-8 gap-1.5 px-2.5 text-xs">
							<Link to="/">
								<IconHome aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
								<span>{t("admin.back_home")}</span>
							</Link>
						</Button>
						<Button asChild variant="outline" size="sm" className="h-8 gap-1.5 px-2.5 text-xs">
							<Link to="/overview">
								<IconLayoutDashboard aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
								<span>{t("admin.back_dashboard")}</span>
							</Link>
						</Button>
					</div>
				</div>
			</header>

			<main className="w-full min-w-0 mx-auto py-4 px-4 sm:px-6 sm:py-6 lg:px-8">
				<RouteErrorBoundary scope="page">
					<Outlet />
				</RouteErrorBoundary>
			</main>
		</div>
	);
}
