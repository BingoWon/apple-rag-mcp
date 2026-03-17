import {
	IconCalendar,
	IconCalendarDue,
	IconCircleCheck,
	IconCreditCard,
	IconExternalLink,
	IconGauge,
} from "@tabler/icons-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
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

	const isOneTime = subscription.payment_type === "one_time";
	const isExpired =
		isOneTime &&
		subscription.current_period_end &&
		new Date(subscription.current_period_end) < new Date();

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
		if (isExpired) return <Badge variant="secondary">{t("billing.expired")}</Badge>;
		if (isOneTime && subscription.status === "active")
			return <Badge variant="outline">{t("billing.onetime_pass")}</Badge>;

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

	const getPlanTitle = () => {
		if (isOneTime) return `${subscription.plan_name} ${t("billing.onetime_pass")}`;
		if (subscription.plan_id === "hobby") return subscription.plan_name;
		return `${subscription.plan_name} ${t("billing.plan_suffix")}`;
	};

	const showPeriod = subscription.plan_id !== "hobby" && subscription.current_period_start;

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between flex-wrap gap-4">
					<div className="flex items-start gap-3 min-w-0">
						<div className="p-2 rounded-lg bg-brand/10 shrink-0">
							<IconCreditCard className="h-5 w-5 text-brand" />
						</div>
						<div className="min-w-0">
							<CardTitle className="flex items-center gap-2 flex-wrap">
								{getPlanTitle()}
								{getStatusBadge()}
							</CardTitle>
							<CardDescription className="mt-1">
								{getPlanDescription(subscription.plan_id)}
							</CardDescription>
						</div>
					</div>
					<div className="text-right shrink-0">
						<div className="text-2xl font-bold text-light">
							{subscription.price > 0 ? formatCurrency(subscription.price) : t("common.free")}
						</div>
						{subscription.price > 0 && !isOneTime && (
							<div className="text-sm text-faint">
								{t("billing.per_interval", { interval: subscription.billing_interval })}
							</div>
						)}
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-5">
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<DetailItem
						icon={<IconCircleCheck className="h-4 w-4" />}
						label={t("billing.status")}
						value={isExpired ? t("billing.expired") : subscription.status}
					/>
					<DetailItem
						icon={<IconGauge className="h-4 w-4" />}
						label={t("billing.weekly_quota")}
						value={
							subscription.weekly_quota === -1
								? t("common.unlimited")
								: `${subscription.weekly_quota.toLocaleString()} ${t("billing.queries")}`
						}
					/>
					{showPeriod && (
						<>
							<DetailItem
								icon={<IconCalendar className="h-4 w-4" />}
								label={t("billing.current_period")}
								value={`${formatDate(subscription.current_period_start)} - ${formatDate(subscription.current_period_end)}`}
							/>
							<DetailItem
								icon={<IconCalendarDue className="h-4 w-4" />}
								label={
									isOneTime
										? t("billing.expires_on", {
												date: formatDate(subscription.current_period_end),
											})
										: t("billing.next_billing")
								}
								value={
									isOneTime
										? undefined
										: subscription.cancel_at_period_end
											? t("billing.cancelled_at_end")
											: formatDate(subscription.current_period_end)
								}
							/>
						</>
					)}
				</div>

				{isOneTime ? (
					<div className="pt-2 flex gap-3">
						<Link to="/#pricing" className="flex-1">
							<Button variant="outline" className="w-full">
								{t("billing.buy_again")}
							</Button>
						</Link>
						<Link to="/#pricing" className="flex-1">
							<Button variant="primary" className="w-full">
								{t("billing.upgrade_to_subscription")}
							</Button>
						</Link>
					</div>
				) : (
					subscription.stripe_customer_id && (
						<div className="pt-2 space-y-2">
							<Button
								onClick={handleManageSubscription}
								disabled={isManagingSubscription}
								className="w-full"
								variant="outline"
							>
								<IconExternalLink className="h-4 w-4 mr-2" />
								{isManagingSubscription ? t("billing.manage_opening") : t("billing.manage")}
							</Button>
							<p className="text-xs text-faint text-center">{t("billing.manage_desc")}</p>
						</div>
					)
				)}
			</CardContent>
		</Card>
	);
}

function DetailItem({
	icon,
	label,
	value,
}: { icon: React.ReactNode; label: string; value?: string }) {
	return (
		<div className="flex items-start gap-2.5">
			<span className="text-faint mt-0.5 shrink-0">{icon}</span>
			<div className="min-w-0">
				<span className="text-xs font-medium text-faint block">{label}</span>
				{value && <span className="text-sm text-light mt-0.5 block">{value}</span>}
			</div>
		</div>
	);
}
