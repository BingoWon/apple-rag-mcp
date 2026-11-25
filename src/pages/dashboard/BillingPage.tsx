import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { SubscriptionCard } from "@/components/billing/SubscriptionCard";
import { PricingSection } from "@/components/sections/PricingSection";
import { Button } from "@/components/ui/Button";
import { useDashboardStore } from "@/stores/dashboard";

export default function BillingPage() {
	const { t } = useTranslation();

	const { subscription, currentUsage, errors, fetchSubscription, fetchCurrentUsage } =
		useDashboardStore();

	useEffect(() => {
		fetchSubscription();
		fetchCurrentUsage();
	}, [fetchSubscription, fetchCurrentUsage]);

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold text-foreground">{t("billing.title")}</h1>
				<p className="mt-1 text-sm text-muted">{t("billing.subtitle")}</p>
			</div>

			{subscription && <SubscriptionCard subscription={subscription} usage={currentUsage} />}

			{errors.subscription ? (
				<div role="alert" className="flex items-center gap-3">
					<span>{t("billing.load_error")}</span>
					<Button variant="outline" onClick={() => void fetchSubscription()}>
						{t("common.retry")}
					</Button>
				</div>
			) : (
				!subscription && <p role="status">{t("billing.loading")}</p>
			)}
			{subscription?.plan_id === "hobby" && !errors.subscription && <PricingSection />}
		</div>
	);
}
