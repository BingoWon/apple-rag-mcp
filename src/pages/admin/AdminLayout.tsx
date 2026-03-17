import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { AdminAuth } from "@/components/admin/AdminAuth";
import { Button } from "@/components/ui/Button";
import { LoaderFive } from "@/components/ui/loader";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ADMIN_SESSION_KEY } from "@/lib/constants";

const adminNavItems = [
	{ href: "/admin", label: "Dashboard", exact: true },
	{ href: "/admin/users", label: "Users", exact: false },
	{ href: "/admin/mcp-tokens", label: "MCP Tokens", exact: false },
	{ href: "/admin/authorized-ips", label: "Authorized IPs", exact: false },
	{ href: "/admin/search-logs", label: "Search Logs", exact: false },
	{ href: "/admin/fetch-logs", label: "Fetch Logs", exact: false },
	{ href: "/admin/user-subscriptions", label: "User Subscriptions", exact: false },
	{ href: "/admin/contact-messages", label: "Contact Messages", exact: false },
];

export function AdminLayout() {
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
				<LoaderFive text="Loading admin panel..." />
			</div>
		);
	}

	if (!isAuthenticated) {
		return <AdminAuth onAuthenticated={() => setIsAuthenticated(true)} />;
	}

	return (
		<div className="min-h-screen bg-background">
			<header className="bg-card shadow-sm border-b border-border">
				<div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex justify-between items-center h-16">
						<div className="flex items-center">
							<h1 className="text-xl font-semibold text-foreground">Admin Console</h1>
						</div>
						<div className="flex items-center space-x-4">
							<ThemeToggle />
							<Button
								onClick={handleLogout}
								variant="link"
								size="sm"
								className="text-sm text-muted-foreground hover:text-foreground p-0 h-auto"
							>
								Logout
							</Button>
						</div>
					</div>
				</div>
			</header>

			<nav className="bg-card border-b border-border">
				<div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex space-x-8">
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
									className={`border-b-2 py-4 px-1 text-sm font-medium transition-colors ${
										isActive
											? "border-brand text-brand bg-brand/10"
											: "border-transparent text-muted-foreground hover:text-foreground hover:border-primary"
									}`}
								>
									{item.label}
								</Link>
							);
						})}
					</div>
				</div>
			</nav>

			<main className="max-w-full mx-auto py-6 px-4 sm:px-6 lg:px-8">
				<Outlet />
			</main>
		</div>
	);
}
