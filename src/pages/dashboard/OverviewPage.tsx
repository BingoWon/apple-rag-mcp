import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { AccountActivity } from "@/components/dashboard/AccountActivity";
import StatsCards from "@/components/dashboard/StatsCards";

const AgentUsageGuide = lazy(() =>
	import("@/components/dashboard/AgentUsageGuide").then(({ AgentUsageGuide }) => ({
		default: AgentUsageGuide,
	})),
);
export default function DashboardOverviewPage() {
	const { t } = useTranslation();

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-2xl font-bold text-light">{t("dashboard.title")}</h1>
				<p className="mt-1 text-sm text-muted">{t("dashboard.subtitle")}</p>
			</div>

			<div className="flex min-w-0 flex-col gap-6 lg:grid lg:grid-cols-9 lg:items-start">
				<div className="order-2 min-w-0 lg:order-none lg:col-span-4">
					<Suspense fallback={null}>
						<AgentUsageGuide />
					</Suspense>
				</div>
				<div className="contents lg:col-span-5 lg:block lg:min-w-0">
					<div className="order-3 lg:mb-5">
						<StatsCards />
					</div>
					<div className="order-1 min-w-0">
						<AccountActivity />
					</div>
				</div>
			</div>
		</div>
	);
}
