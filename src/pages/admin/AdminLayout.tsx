import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Outlet, useLocation } from "react-router-dom";
import { AdminAuth } from "@/components/admin/AdminAuth";
import { Button } from "@/components/ui/Button";
import { LoaderFive } from "@/components/ui/loader";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ADMIN_SESSION_KEY } from "@/lib/constants";

const adminNavItems = [
	{ href: "/admin", labelKey: "nav.overview", exact: true },
	{ href: "/admin/users", labelKey: "admin.users", exact: false },
	{ href: "/admin/mcp-tokens", labelKey: "nav.mcp_tokens", exact: false },
	{ href: "/admin/authorized-ips", labelKey: "nav.authorized_ips", exact: false },
	{ href: "/admin/search-logs", labelKey: "admin.search_logs", exact: false },
	{ href: "/admin/fetch-logs", labelKey: "admin.fetch_logs", exact: false },
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
	}, []);

	const handleLogout = () => {
		localStorage.removeItem(ADMIN_SESSION_KEY);
		setIsAuthenticated(false);
	};

	if (isLoading) {
		return (
			<div className="min-h-screen bg-gray-900 flex items-center justify-center">
				<LoaderFive text={t("admin.loading")} />
			</div>
		);
	}

	if (!isAuthenticated) {
		return <AdminAuth onAuthenticated={() => setIsAuthenticated(true)} />;
	}

	return (
		<div className="min-h-screen bg-background">
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
											: "border-transparent text-muted-foreground hover:text-foreground hover:border-primary"
									}`}
								>
									{t(item.labelKey)}
								</Link>
							);
						})}
					</nav>
					<div className="flex shrink-0 items-center gap-2">
						<ThemeToggle />
						<Button
							onClick={handleLogout}
							variant="link"
							size="sm"
							className="h-auto p-0 text-sm text-muted-foreground hover:text-foreground"
						>
							{t("common.logout")}
						</Button>
					</div>
				</div>
			</header>

			<main className="max-w-full mx-auto py-3 px-4 sm:px-6 lg:px-8">
				<Outlet />
			</main>
		</div>
	);
}
