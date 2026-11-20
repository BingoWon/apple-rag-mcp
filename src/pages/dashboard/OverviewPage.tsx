import { lazy, Suspense, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AccountActivity } from "@/components/dashboard/AccountActivity";
import StatsCards from "@/components/dashboard/StatsCards";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { authReturnPath, clearAuthReturn } from "@/lib/auth-return";
import { useAuthStore } from "@/stores/auth";

const AgentUsageGuide = lazy(() =>
	import("@/components/dashboard/AgentUsageGuide").then(({ AgentUsageGuide }) => ({
		default: AgentUsageGuide,
	})),
);
function DashboardOverviewContent() {
	const { t } = useTranslation();

	const [searchParams] = useSearchParams();
	const navigate = useNavigate();
	const { loginWithToken, isAuthenticated, user } = useAuth();
	const processedAuth = useRef(false);

	// Consume the login callback once before loading private data.
	useEffect(() => {
		const handleAuthReturn = async () => {
			const authParam = searchParams.get("login") === "complete";

			// Handle OAuth callback if present (prevent duplicate processing)
			if (authParam && !processedAuth.current) {
				processedAuth.current = true;
				try {
					const response = await api.post<{ token: string }>("/oauth/session/exchange");
					if (!response.success || !response.data) throw Error("Login expired");
					await loginWithToken(response.data.token);

					toast.success(t("dashboard.welcome_oauth", { name: useAuthStore.getState().user?.name }));

					// Clean URL parameters
					const url = new URL(window.location.href);
					url.searchParams.delete("login");
					window.history.replaceState({}, "", url.toString());
					const returnPath = authReturnPath();
					clearAuthReturn();
					if (returnPath !== "/overview") {
						navigate(returnPath, { replace: true });
						return;
					}
				} catch (_error) {
					toast.error(t("dashboard.auth_failed"));
					navigate("/login", { replace: true });
				}
			}
		};

		handleAuthReturn();
	}, [searchParams, navigate, loginWithToken, t]);

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-2xl font-bold text-light">{t("dashboard.title")}</h1>
				<p className="mt-1 text-sm text-muted">{t("dashboard.subtitle")}</p>
			</div>

			{isAuthenticated && (
				<div className="flex min-w-0 flex-col gap-6 lg:grid lg:grid-cols-9 lg:items-start">
					<div className="order-2 min-w-0 lg:order-none lg:col-span-4">
						<AgentUsageGuide />
					</div>
					<div className="contents lg:col-span-5 lg:block lg:min-w-0">
						<div className="order-3 lg:mb-5">
							<StatsCards />
						</div>
						<div className="order-1 min-w-0">
							<AccountActivity key={user?.id} />
						</div>
					</div>
				</div>
			)}
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
