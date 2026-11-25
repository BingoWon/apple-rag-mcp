import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Route, Routes } from "react-router-dom";
import { lazyWithRecovery } from "@/lib/deployment-recovery";

const ConnectPage = lazyWithRecovery(() => import("@/pages/ConnectPage"));
const UpdatesPage = lazyWithRecovery(() => import("@/pages/UpdatesPage"));
const CLIAuthorizePage = lazyWithRecovery(() => import("@/pages/cli/AuthorizePage"));
const DashboardLayout = lazyWithRecovery(() => import("@/components/layout/DashboardLayout"));
const HomePage = lazyWithRecovery(() => import("@/pages/HomePage"));
const LoginPage = lazyWithRecovery(() => import("@/pages/auth/LoginPage"));
const RegisterPage = lazyWithRecovery(() => import("@/pages/auth/RegisterPage"));
const ForgotPasswordPage = lazyWithRecovery(() => import("@/pages/auth/ForgotPasswordPage"));
const ResetPasswordPage = lazyWithRecovery(() => import("@/pages/auth/ResetPasswordPage"));
const OverviewPage = lazyWithRecovery(() => import("@/pages/dashboard/OverviewPage"));
const SettingsPage = lazyWithRecovery(() => import("@/pages/dashboard/SettingsPage"));
const MessagesPage = lazyWithRecovery(() => import("@/pages/dashboard/MessagesPage"));
const UsagePage = lazyWithRecovery(() => import("@/pages/dashboard/UsagePage"));
const AuthorizedIPsPage = lazyWithRecovery(() => import("@/pages/dashboard/AuthorizedIPsPage"));
const MCPTokensPage = lazyWithRecovery(() => import("@/pages/dashboard/MCPTokensPage"));
const BillingPage = lazyWithRecovery(() => import("@/pages/dashboard/BillingPage"));
const SuccessPage = lazyWithRecovery(() => import("@/pages/SuccessPage"));
const NotFoundPage = lazyWithRecovery(() => import("@/pages/NotFoundPage"));
const AdminDashboard = lazyWithRecovery(() => import("@/pages/admin/AdminDashboard"));
const AdminClientsPage = lazyWithRecovery(() => import("@/pages/admin/ClientsPage"));
const AdminUsersPage = lazyWithRecovery(() => import("@/pages/admin/UsersPage"));
const AdminMCPTokensPage = lazyWithRecovery(() => import("@/pages/admin/MCPTokensPage"));
const AdminAuthorizedIPsPage = lazyWithRecovery(() => import("@/pages/admin/AuthorizedIPsPage"));
const AdminSearchLogsPage = lazyWithRecovery(() => import("@/pages/admin/SearchLogsPage"));
const AdminBrowseLogsPage = lazyWithRecovery(() => import("@/pages/admin/BrowseLogsPage"));
const AdminFetchLogsPage = lazyWithRecovery(() => import("@/pages/admin/FetchLogsPage"));
const AdminUserSubscriptionsPage = lazyWithRecovery(
	() => import("@/pages/admin/UserSubscriptionsPage"),
);
const AdminContactMessagesPage = lazyWithRecovery(
	() => import("@/pages/admin/ContactMessagesPage"),
);
const AuthLayout = lazyWithRecovery(() =>
	import("@/pages/auth/AuthLayout").then(({ AuthLayout }) => ({ default: AuthLayout })),
);
const LegalLayout = lazyWithRecovery(() =>
	import("@/pages/legal/LegalLayout").then(({ LegalLayout }) => ({ default: LegalLayout })),
);
const AdminLayout = lazyWithRecovery(() =>
	import("@/pages/admin/AdminLayout").then(({ AdminLayout }) => ({ default: AdminLayout })),
);

function RouteFallback() {
	const { t } = useTranslation();
	return (
		<div
			className="flex min-h-screen items-center justify-center bg-background text-muted"
			role="status"
		>
			{t("common.loading")}
		</div>
	);
}

export function AppRouter() {
	return (
		<Suspense fallback={<RouteFallback />}>
			<Routes>
				{/* Home */}
				<Route path="/" element={<HomePage />} />
				<Route path="/connect" element={<ConnectPage />} />
				<Route path="/updates" element={<UpdatesPage />} />

				{/* Auth */}
				<Route element={<AuthLayout />}>
					<Route path="/login" element={<LoginPage />} />
					<Route path="/register" element={<RegisterPage />} />
					<Route path="/forgot-password" element={<ForgotPasswordPage />} />
					<Route path="/reset-password" element={<ResetPasswordPage />} />
				</Route>

				<Route path="/cli/authorize" element={<CLIAuthorizePage />} />

				{/* Dashboard (auth-protected) */}
				<Route
					path="/overview"
					element={
						<DashboardLayout>
							<OverviewPage />
						</DashboardLayout>
					}
				/>
				<Route
					path="/settings"
					element={
						<DashboardLayout>
							<SettingsPage />
						</DashboardLayout>
					}
				/>
				<Route
					path="/messages"
					element={
						<DashboardLayout>
							<MessagesPage />
						</DashboardLayout>
					}
				/>
				<Route
					path="/usage"
					element={
						<DashboardLayout>
							<UsagePage />
						</DashboardLayout>
					}
				/>
				<Route
					path="/authorized-ips"
					element={
						<DashboardLayout>
							<AuthorizedIPsPage />
						</DashboardLayout>
					}
				/>
				<Route
					path="/mcp-tokens"
					element={
						<DashboardLayout>
							<MCPTokensPage />
						</DashboardLayout>
					}
				/>
				<Route
					path="/billing"
					element={
						<DashboardLayout>
							<BillingPage />
						</DashboardLayout>
					}
				/>

				{/* Legal */}
				<Route element={<LegalLayout />}>
					<Route path="/privacy-policy" element={null} />
					<Route path="/terms-of-service" element={null} />
				</Route>

				{/* Admin */}
				<Route path="/admin" element={<AdminLayout />}>
					<Route index element={<AdminDashboard />} />
					<Route path="clients" element={<AdminClientsPage />} />
					<Route path="users" element={<AdminUsersPage />} />
					<Route path="mcp-tokens" element={<AdminMCPTokensPage />} />
					<Route path="authorized-ips" element={<AdminAuthorizedIPsPage />} />
					<Route path="search-logs" element={<AdminSearchLogsPage />} />
					<Route path="browse-logs" element={<AdminBrowseLogsPage />} />
					<Route path="fetch-logs" element={<AdminFetchLogsPage />} />
					<Route path="user-subscriptions" element={<AdminUserSubscriptionsPage />} />
					<Route path="contact-messages" element={<AdminContactMessagesPage />} />
				</Route>

				{/* Other */}
				<Route path="/success" element={<SuccessPage />} />
				<Route path="*" element={<NotFoundPage />} />
			</Routes>
		</Suspense>
	);
}
