import { Suspense, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { SubscriptionCard } from "@/components/billing/SubscriptionCard";
import { PricingSection } from "@/components/sections/PricingSection";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatDate } from "@/lib/utils";
import { useDashboardStore } from "@/stores/dashboard";

function BillingPageContent() {
	const { t } = useTranslation();
	const [searchParams] = useSearchParams();
	const { subscription, currentUsage, fetchSubscription } = useDashboardStore();

	const processedParams = useRef(new Set<string>());

	useEffect(() => {
		fetchSubscription();

		// Check for success parameter from Stripe redirect
		const successParam = searchParams.get("success");
		if (successParam === "true" && !processedParams.current.has("success")) {
			processedParams.current.add("success");
			toast.success(t("billing.payment_success"));
		}

		// Check for refresh parameter from Stripe Customer Portal return
		const refreshParam = searchParams.get("refresh");
		if (refreshParam === "true" && !processedParams.current.has("refresh")) {
			processedParams.current.add("refresh");

			// Clear the URL parameter
			const url = new URL(window.location.href);
			url.searchParams.delete("refresh");
			window.history.replaceState({}, "", url.toString());

			// Show success message
			toast.success(t("billing.subscription_updated"));
		}
	}, [fetchSubscription, searchParams, t]);

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-2xl font-bold text-light">{t("billing.title")}</h1>
				<p className="mt-1 text-sm text-muted">{t("billing.subtitle")}</p>
			</div>

			{/* Current Usage */}
			{currentUsage && (
				<Card>
					<CardHeader>
						<CardTitle>{t("billing.current_usage")}</CardTitle>
						<CardDescription>{t("billing.usage_desc")}</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							<div className="flex items-center justify-between">
								<span className="text-sm font-medium text-muted">{t("billing.queries_used")}</span>
								<span className="text-sm text-light">
									{currentUsage.current_usage.toLocaleString()} /{" "}
									{currentUsage.limit === -1
										? t("common.unlimited")
										: currentUsage.limit.toLocaleString()}
								</span>
							</div>
							<div className="w-full bg-secondary rounded-full h-2">
								<div
									className="bg-brand h-2 rounded-full"
									style={{
										width:
											currentUsage.limit === -1
												? "0%"
												: `${Math.min(
														(currentUsage.current_usage / currentUsage.limit) * 100,
														100,
													)}%`,
									}}
								></div>
							</div>
							<div className="flex items-center justify-between text-sm text-faint">
								<span>
									{t("billing.remaining", { count: currentUsage.remaining.toLocaleString() })}
								</span>
								<span>{t("billing.resets_on", { date: formatDate(currentUsage.reset_at) })}</span>
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Current Subscription */}
			{subscription && <SubscriptionCard subscription={subscription} />}

			{/* Upgrade Options */}
			{subscription?.plan_id === "hobby" && <PricingSection />}
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
