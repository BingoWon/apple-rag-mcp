import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { SubscriptionCard } from "@/components/billing/SubscriptionCard";
import { PricingSection } from "@/components/sections/PricingSection";
import { Button } from "@/components/ui/Button";
import { useDashboardStore } from "@/stores/dashboard";

export default function BillingPage() {
	const { t } = useTranslation();

	const {
		subscription,
		currentUsage,
		isLoadingSubscription,
		errors,
		fetchSubscription,
		fetchCurrentUsage,
	} = useDashboardStore();

	useEffect(() => {
		fetchSubscription();
		fetchCurrentUsage();
	}, [fetchSubscription, fetchCurrentUsage]);

	const showUpgradeSection =
		Boolean(subscription) &&
		!errors.subscription &&
		subscription?.plan_id === "hobby" &&
		subscription?.payment_type !== "one_time" &&
		!subscription?.has_active_stripe_subscription;

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold text-foreground">{t("billing.title")}</h1>
				<p className="mt-1 text-sm text-muted">{t("billing.subtitle")}</p>
			</div>

			{errors.subscription ? (
				<div
					role="alert"
					className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm"
				>
					<span className="text-destructive">{t("billing.load_error")}</span>
					<Button
						variant="outline"
						size="sm"
						loading={isLoadingSubscription}
						onClick={() => void fetchSubscription()}
					>
						{t("common.retry")}
					</Button>
				</div>
			) : subscription ? (
				<SubscriptionCard
					subscription={subscription}
					usage={currentUsage}
					quotaError={errors.quota}
					onRetryQuota={() => void fetchCurrentUsage()}
				/>
			) : (
				<p role="status" className="text-sm text-muted">
					{t("billing.loading")}
				</p>
			)}

			{showUpgradeSection && <PricingSection embedded />}
		</div>
	);
}
