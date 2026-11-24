import { AuthGuard } from "@/components/auth/AuthGuard";
import { RouteErrorBoundary } from "@/components/ErrorBoundary";
import { AppleSidebar } from "@/components/layout/AppleSidebar";

export default function DashboardLayout({ children }: { children?: React.ReactNode }) {
	return (
		<AuthGuard>
			<AppleSidebar>
				<RouteErrorBoundary scope="page">{children}</RouteErrorBoundary>
			</AppleSidebar>
		</AuthGuard>
	);
}
