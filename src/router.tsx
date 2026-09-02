import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";

const DashboardLayout = lazy(() => import("@/components/layout/DashboardLayout"));
const HomePage = lazy(() => import("@/pages/HomePage"));
const LoginPage = lazy(() => import("@/pages/auth/LoginPage"));
const RegisterPage = lazy(() => import("@/pages/auth/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/auth/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("@/pages/auth/ResetPasswordPage"));
const OverviewPage = lazy(() => import("@/pages/dashboard/OverviewPage"));
const SettingsPage = lazy(() => import("@/pages/dashboard/SettingsPage"));
const MessagesPage = lazy(() => import("@/pages/dashboard/MessagesPage"));
const UsagePage = lazy(() => import("@/pages/dashboard/UsagePage"));
const AuthorizedIPsPage = lazy(() => import("@/pages/dashboard/AuthorizedIPsPage"));
const MCPTokensPage = lazy(() => import("@/pages/dashboard/MCPTokensPage"));
const BillingPage = lazy(() => import("@/pages/dashboard/BillingPage"));
const SuccessPage = lazy(() => import("@/pages/SuccessPage"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminUsersPage = lazy(() => import("@/pages/admin/UsersPage"));
const AdminMCPTokensPage = lazy(() => import("@/pages/admin/MCPTokensPage"));
const AdminAuthorizedIPsPage = lazy(() => import("@/pages/admin/AuthorizedIPsPage"));
const AdminSearchLogsPage = lazy(() => import("@/pages/admin/SearchLogsPage"));
const AdminFetchLogsPage = lazy(() => import("@/pages/admin/FetchLogsPage"));
const AdminUserSubscriptionsPage = lazy(() => import("@/pages/admin/UserSubscriptionsPage"));
const AdminContactMessagesPage = lazy(() => import("@/pages/admin/ContactMessagesPage"));
const AuthLayout = lazy(() =>
	import("@/pages/auth/AuthLayout").then(({ AuthLayout }) => ({ default: AuthLayout })),
);
const LegalLayout = lazy(() =>
	import("@/pages/legal/LegalLayout").then(({ LegalLayout }) => ({ default: LegalLayout })),
);
const AdminLayout = lazy(() =>
	import("@/pages/admin/AdminLayout").then(({ AdminLayout }) => ({ default: AdminLayout })),
);

function RouteFallback() {
	return (
		<div
			className="flex min-h-screen items-center justify-center bg-background text-muted"
			role="status"
		>
			Loading...
		</div>
	);
}

export function AppRouter() {
	return (
		<Suspense fallback={<RouteFallback />}>
			<Routes>
				{/* Home */}
				<Route path="/" element={<HomePage />} />

				{/* Auth */}
				<Route element={<AuthLayout />}>
					<Route path="/login" element={<LoginPage />} />
					<Route path="/register" element={<RegisterPage />} />
					<Route path="/forgot-password" element={<ForgotPasswordPage />} />
					<Route path="/reset-password" element={<ResetPasswordPage />} />
				</Route>

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
					<Route path="users" element={<AdminUsersPage />} />
					<Route path="mcp-tokens" element={<AdminMCPTokensPage />} />
					<Route path="authorized-ips" element={<AdminAuthorizedIPsPage />} />
					<Route path="search-logs" element={<AdminSearchLogsPage />} />
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
