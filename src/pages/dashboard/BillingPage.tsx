import { Suspense, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { SubscriptionCard } from "@/components/billing/SubscriptionCard";
import { PricingSection } from "@/components/sections/PricingSection";
import { useDashboardStore } from "@/stores/dashboard";

function BillingPageContent() {
	const { t } = useTranslation();
	const [searchParams] = useSearchParams();
	const { subscription, currentUsage, fetchSubscription, fetchCurrentUsage } = useDashboardStore();

	const processedParams = useRef(new Set<string>());

	useEffect(() => {
		fetchSubscription();
		fetchCurrentUsage();

		const successParam = searchParams.get("success");
		if (successParam === "true" && !processedParams.current.has("success")) {
			processedParams.current.add("success");
			toast.success(t("billing.payment_success"));
		}

		const refreshParam = searchParams.get("refresh");
		if (refreshParam === "true" && !processedParams.current.has("refresh")) {
			processedParams.current.add("refresh");

			const url = new URL(window.location.href);
			url.searchParams.delete("refresh");
			window.history.replaceState({}, "", url.toString());

			toast.success(t("billing.subscription_updated"));
		}
	}, [fetchSubscription, fetchCurrentUsage, searchParams, t]);

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold text-light">{t("billing.title")}</h1>
				<p className="mt-1 text-sm text-muted">{t("billing.subtitle")}</p>
			</div>

			{subscription && <SubscriptionCard subscription={subscription} usage={currentUsage} />}

			{(!subscription || subscription.plan_id === "hobby") && <PricingSection />}
		</div>
	);
}

export default function BillingPage() {
	return (
		<Suspense fallback={<div></div>}>
			<BillingPageContent />
		</Suspense>
	);
}
