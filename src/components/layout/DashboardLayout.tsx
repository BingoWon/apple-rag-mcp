import { AuthGuard } from "@/components/auth/AuthGuard";
import { AppleSidebar } from "@/components/layout/AppleSidebar";

export default function DashboardLayout({ children }: { children?: React.ReactNode }) {
	return (
		<AuthGuard>
			<AppleSidebar>{children}</AppleSidebar>
		</AuthGuard>
	);
}
