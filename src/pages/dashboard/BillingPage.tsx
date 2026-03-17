import { Suspense, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { useSearchParams } from "react-router-dom";
import { SubscriptionCard } from "@/components/billing/SubscriptionCard";
import { PricingSection } from "@/components/sections/PricingSection";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatDate } from "@/lib/utils";
import { useDashboardStore } from "@/stores/dashboard";

function BillingPageContent() {
	const [searchParams] = useSearchParams();
	const { subscription, currentUsage, fetchSubscription } = useDashboardStore();

	const processedParams = useRef(new Set<string>());

	useEffect(() => {
		fetchSubscription();

		// Check for success parameter from Stripe redirect
		const successParam = searchParams.get("success");
		if (successParam === "true" && !processedParams.current.has("success")) {
			processedParams.current.add("success");
			toast.success("Payment successful!\nYour subscription has been updated successfully.");
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
			toast.success("Subscription updated!\nYour changes have been saved successfully.");
		}
	}, [fetchSubscription, searchParams]);

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-2xl font-bold text-light">Billing & Subscription</h1>
				<p className="mt-1 text-sm text-muted">
					Manage your subscription, view usage, and billing history
				</p>
			</div>

			{/* Current Usage */}
			{currentUsage && (
				<Card>
					<CardHeader>
						<CardTitle>Current Usage</CardTitle>
						<CardDescription>Your MCP usage for the current billing period</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							<div className="flex items-center justify-between">
								<span className="text-sm font-medium text-muted">Queries Used</span>
								<span className="text-sm text-light">
									{currentUsage.current_usage.toLocaleString()} /{" "}
									{currentUsage.limit === -1 ? "Unlimited" : currentUsage.limit.toLocaleString()}
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
								<span>{currentUsage.remaining.toLocaleString()} remaining</span>
								<span>Resets on {formatDate(currentUsage.reset_at)}</span>
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
