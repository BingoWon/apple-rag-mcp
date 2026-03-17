import { Route, Routes } from "react-router-dom";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AppleSidebar } from "@/components/layout/AppleSidebar";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import { AdminLayout } from "@/pages/admin/AdminLayout";
import AdminAuthorizedIPsPage from "@/pages/admin/AuthorizedIPsPage";
import AdminContactMessagesPage from "@/pages/admin/ContactMessagesPage";
import AdminFetchLogsPage from "@/pages/admin/FetchLogsPage";
import AdminMCPTokensPage from "@/pages/admin/MCPTokensPage";
import AdminSearchLogsPage from "@/pages/admin/SearchLogsPage";
import AdminUserSubscriptionsPage from "@/pages/admin/UserSubscriptionsPage";
import AdminUsersPage from "@/pages/admin/UsersPage";
import { AuthLayout } from "@/pages/auth/AuthLayout";
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage";
import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import ResetPasswordPage from "@/pages/auth/ResetPasswordPage";
import DesignSystemPage from "@/pages/DesignSystemPage";
import AuthorizedIPsPage from "@/pages/dashboard/AuthorizedIPsPage";
import BillingPage from "@/pages/dashboard/BillingPage";
import MCPTokensPage from "@/pages/dashboard/MCPTokensPage";
import MessagesPage from "@/pages/dashboard/MessagesPage";
import OverviewPage from "@/pages/dashboard/OverviewPage";
import SettingsPage from "@/pages/dashboard/SettingsPage";
import UsagePage from "@/pages/dashboard/UsagePage";
import HomePage from "@/pages/HomePage";
import { LegalLayout } from "@/pages/legal/LegalLayout";
import NotFoundPage from "@/pages/NotFoundPage";
import SuccessPage from "@/pages/SuccessPage";

function DashboardLayout({ children }: { children?: React.ReactNode }) {
	return (
		<AuthGuard>
			<AppleSidebar>{children}</AppleSidebar>
		</AuthGuard>
	);
}

export function AppRouter() {
	return (
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
			<Route path="/design-system" element={<DesignSystemPage />} />
			<Route path="*" element={<NotFoundPage />} />
		</Routes>
	);
}
