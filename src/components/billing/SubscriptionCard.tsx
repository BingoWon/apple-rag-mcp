import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Subscription } from "@/types";

interface SubscriptionCardProps {
	subscription: Subscription;
}

export function SubscriptionCard({ subscription }: SubscriptionCardProps) {
	const { t } = useTranslation();
	const [isManagingSubscription, setIsManagingSubscription] = useState(false);

	// Get plan description based on plan_id
	const getPlanDescription = (planId: string) => {
		switch (planId) {
			case "hobby":
				return t("plans.hobby_desc");
			case "pro":
				return t("plans.pro_desc");
			case "enterprise":
				return t("plans.enterprise_desc");
			default:
				return t("billing.your_plan");
		}
	};

	const getStatusBadge = () => {
		switch (subscription.status) {
			case "active":
				return <Badge variant="success">{t("billing.active")}</Badge>;
			case "trialing":
				return <Badge variant="outline">{t("billing.trial")}</Badge>;
			case "canceled":
				return <Badge variant="secondary">{t("billing.cancelled")}</Badge>;
			case "past_due":
				return <Badge variant="warning">{t("billing.past_due")}</Badge>;
			case "incomplete":
				return <Badge variant="warning">{t("billing.incomplete")}</Badge>;
			default:
				return <Badge variant="secondary">{subscription.status}</Badge>;
		}
	};

	const handleManageSubscription = async () => {
		setIsManagingSubscription(true);
		try {
			const response = await api.createBillingPortalSession();
			if (response.success && response.data?.url) {
				window.location.href = response.data.url;
			}
		} catch (error) {
			console.error("Failed to create billing portal session:", error);
			toast.error(t("billing.manage_error"));
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
								: `${subscription.plan_name} ${t("billing.plan_suffix")}`}
							{getStatusBadge()}
						</CardTitle>
						<CardDescription>{getPlanDescription(subscription.plan_id)}</CardDescription>
					</div>
					<div className="text-right">
						<div className="text-2xl font-bold">
							{subscription.price > 0 ? formatCurrency(subscription.price) : t("common.free")}
						</div>
						{subscription.price > 0 && (
							<div className="text-sm text-gray-500">
								{t("billing.per_interval", { interval: subscription.billing_interval })}
							</div>
						)}
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid grid-cols-2 gap-4 text-sm">
					<div>
						<span className="font-medium text-gray-500">{t("billing.status")}</span>
						<div className="mt-1">{subscription.status}</div>
					</div>
					<div>
						<span className="font-medium text-gray-500">{t("billing.weekly_quota")}</span>
						<div className="mt-1">
							{subscription.weekly_quota === -1
								? t("common.unlimited")
								: subscription.weekly_quota.toLocaleString()}{" "}
							{t("billing.queries")}
						</div>
					</div>
					{subscription.plan_id !== "hobby" && subscription.current_period_start && (
						<>
							<div>
								<span className="font-medium text-gray-500">{t("billing.current_period")}</span>
								<div className="mt-1">
									{formatDate(subscription.current_period_start)} -{" "}
									{formatDate(subscription.current_period_end)}
								</div>
							</div>
							<div>
								<span className="font-medium text-gray-500">{t("billing.next_billing")}</span>
								<div className="mt-1">
									{subscription.cancel_at_period_end
										? t("billing.cancelled_at_end")
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
							{isManagingSubscription ? t("billing.manage_opening") : t("billing.manage")}
						</Button>
						<p className="text-sm text-gray-500 mt-2 text-center">{t("billing.manage_desc")}</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
