import { useState } from "react";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { api } from "@/services/api";
import type { Subscription } from "@/types";

interface SubscriptionCardProps {
	subscription: Subscription;
}

export function SubscriptionCard({ subscription }: SubscriptionCardProps) {
	const [isManagingSubscription, setIsManagingSubscription] = useState(false);

	// Get plan description based on plan_id
	const getPlanDescription = (planId: string) => {
		switch (planId) {
			case "hobby":
				return "Perfect for getting started and small projects.";
			case "pro":
				return "Best for professional developers and growing teams.";
			case "enterprise":
				return "Advanced features for large teams and organizations.";
			default:
				return "Your current subscription plan";
		}
	};

	const getStatusBadge = () => {
		switch (subscription.status) {
			case "active":
				return <Badge variant="success">Active</Badge>;
			case "trialing":
				return <Badge variant="outline">Trial</Badge>;
			case "canceled":
				return <Badge variant="secondary">Cancelled</Badge>;
			case "past_due":
				return <Badge variant="warning">Past Due</Badge>;
			case "incomplete":
				return <Badge variant="warning">Incomplete</Badge>;
			default:
				return <Badge variant="secondary">{subscription.status}</Badge>;
		}
	};

	const handleManageSubscription = async () => {
		setIsManagingSubscription(true);
		try {
			const response = await api.stripe.createBillingPortalSession();
			// Redirect to Stripe Customer Portal for all subscription management
			window.location.href = response.url;
		} catch (error) {
			console.error("Failed to create billing portal session:", error);
			toast.error("Unable to open billing management. Please contact support if this persists.");
		} finally {
			setIsManagingSubscription(false);
		}
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							{subscription.plan_id === "hobby"
								? subscription.plan_name
								: `${subscription.plan_name} Plan`}
							{getStatusBadge()}
						</CardTitle>
						<CardDescription>{getPlanDescription(subscription.plan_id)}</CardDescription>
					</div>
					<div className="text-right">
						<div className="text-2xl font-bold">
							{subscription.price > 0 ? formatCurrency(subscription.price) : "Free"}
						</div>
						{subscription.price > 0 && (
							<div className="text-sm text-gray-500">per {subscription.billing_interval}</div>
						)}
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid grid-cols-2 gap-4 text-sm">
					<div>
						<span className="font-medium text-gray-500">Status:</span>
						<div className="mt-1">{subscription.status}</div>
					</div>
					<div>
						<span className="font-medium text-gray-500">Weekly Quota:</span>
						<div className="mt-1">
							{subscription.weekly_quota === -1
								? "Unlimited"
								: subscription.weekly_quota.toLocaleString()}{" "}
							queries
						</div>
					</div>
					{subscription.plan_id !== "hobby" && subscription.current_period_start && (
						<>
							<div>
								<span className="font-medium text-gray-500">Current Period:</span>
								<div className="mt-1">
									{formatDate(subscription.current_period_start)} -{" "}
									{formatDate(subscription.current_period_end)}
								</div>
							</div>
							<div>
								<span className="font-medium text-gray-500">Next Billing:</span>
								<div className="mt-1">
									{subscription.cancel_at_period_end
										? "Cancelled at period end"
										: formatDate(subscription.current_period_end)}
								</div>
							</div>
						</>
					)}
				</div>

				{subscription.stripe_customer_id && (
					<div className="pt-4">
						<Button
							onClick={handleManageSubscription}
							disabled={isManagingSubscription}
							className="w-full"
							variant="outline"
						>
							{isManagingSubscription ? "Opening..." : "Manage Subscription & Billing"}
						</Button>
						<p className="text-sm text-gray-500 mt-2 text-center">
							Manage your subscription, update payment methods, view invoice history, download
							invoices, and more
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
