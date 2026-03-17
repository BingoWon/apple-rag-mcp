import { Suspense, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { useSearchParams } from "react-router-dom";
import { MCPUsageGuide } from "@/components/dashboard/MCPUsageGuide";
import StatsCards from "@/components/dashboard/StatsCards";
import { ToolCallsChart } from "@/components/dashboard/ToolCallsChart";
import { XcodeBuildMCPRecommendation } from "@/components/dashboard/XcodeBuildMCPRecommendation";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardStore } from "@/stores/dashboard";

function DashboardOverviewContent() {
	const { toolCallsStats, refreshDashboard } = useDashboardStore();

	const [searchParams] = useSearchParams();
	const { loginWithToken } = useAuth();
	const processedAuth = useRef(false);

	// Modern OAuth and data loading effect
	useEffect(() => {
		const handleOAuthAndLoadData = async () => {
			const authParam = searchParams.get("auth");

			// Handle OAuth callback if present (prevent duplicate processing)
			if (authParam && !processedAuth.current) {
				processedAuth.current = true;
				try {
					const authData = JSON.parse(atob(decodeURIComponent(authParam)));
					await loginWithToken(authData.jwtToken);

					toast.success(`Welcome ${authData.name}! Successfully authenticated via OAuth.`);

					// Clean URL parameters
					const url = new URL(window.location.href);
					url.searchParams.delete("auth");
					window.history.replaceState({}, "", url.toString());
				} catch (_error) {
					toast.error("Authentication failed. Please try again.");
				}
			}

			// Load dashboard data
			refreshDashboard();
		};

		handleOAuthAndLoadData();
	}, [
		searchParams,
		loginWithToken, // Load dashboard data
		refreshDashboard,
	]);

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-2xl font-bold text-light">Dashboard Overview</h1>
				<p className="mt-1 text-sm text-muted">Monitor your MCP usage and manage your account</p>
			</div>

			{/* Main Content - Left/Right Layout */}
			<div className="grid grid-cols-1 lg:grid-cols-9 gap-6">
				{/* Left Side - MCP Usage Guide */}
				<div className="lg:col-span-4">
					<MCPUsageGuide />
				</div>

				{/* Right Side - Stats Cards and Interactive Charts */}
				<div className="lg:col-span-5">
					<div className="mb-5">
						<StatsCards />
					</div>
					<ToolCallsChart
						data={toolCallsStats?.calls_by_day || []}
						totalToolCalls={toolCallsStats?.total_tool_calls || 0}
						totalResults={toolCallsStats?.total_results || 0}
					/>
					<XcodeBuildMCPRecommendation />
				</div>
			</div>
		</div>
	);
}

export default function DashboardOverviewPage() {
	return (
		<Suspense fallback={<div></div>}>
			<DashboardOverviewContent />
		</Suspense>
	);
}
