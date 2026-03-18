import { Suspense, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { MCPUsageGuide } from "@/components/dashboard/MCPUsageGuide";
import StatsCards from "@/components/dashboard/StatsCards";
import { ToolCallsChart } from "@/components/dashboard/ToolCallsChart";
import { AppleRAGMCPIntro } from "@/components/dashboard/AppleRAGMCPIntro";
import { XcodeBuildMCPRecommendation } from "@/components/dashboard/XcodeBuildMCPRecommendation";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardStore } from "@/stores/dashboard";

function DashboardOverviewContent() {
	const { t } = useTranslation();
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

					toast.success(t("dashboard.welcome_oauth", { name: authData.name }));

					// Clean URL parameters
					const url = new URL(window.location.href);
					url.searchParams.delete("auth");
					window.history.replaceState({}, "", url.toString());
				} catch (_error) {
					toast.error(t("dashboard.auth_failed"));
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
		t,
	]);

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-2xl font-bold text-light">{t("dashboard.title")}</h1>
				<p className="mt-1 text-sm text-muted">{t("dashboard.subtitle")}</p>
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
					<AppleRAGMCPIntro />
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
