import type { TFunction } from "i18next";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { PricingModal } from "@/components/sections/PricingModal";
import { Modal, ModalTrigger } from "@/components/ui/animated-modal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { CurrentUsage, Subscription } from "@/types";

interface SubscriptionCardProps {
	subscription: Subscription;
	usage?: CurrentUsage | null;
}

const INTERVAL_MAP: Record<string, { perKey: string; passKey: string }> = {
	week: { perKey: "per_week", passKey: "onetime_weekly" },
	weekly: { perKey: "per_week", passKey: "onetime_weekly" },
	month: { perKey: "per_month", passKey: "onetime_monthly" },
	monthly: { perKey: "per_month", passKey: "onetime_monthly" },
	"6 months": { perKey: "per_6months", passKey: "onetime_semiannual" },
	semiannual: { perKey: "per_6months", passKey: "onetime_semiannual" },
	year: { perKey: "per_year", passKey: "onetime_annual" },
	annual: { perKey: "per_year", passKey: "onetime_annual" },
};

export function SubscriptionCard({ subscription, usage }: SubscriptionCardProps) {
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
		if (isExpired) {
			return <Badge variant="secondary">{t("billing.expired")}</Badge>;
		}
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

	const interval = INTERVAL_MAP[subscription.billing_interval] || INTERVAL_MAP.month;

	const getPlanTitle = () => {
		if (isOneTime) {
			return `${subscription.plan_name} ${t(`pricing.${interval.passKey}`)}`;
		}
		if (subscription.plan_id === "hobby") {
			return subscription.plan_name;
		}
		return `${subscription.plan_name} ${t("billing.plan_suffix")}`;
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							{getPlanTitle()}
							{getStatusBadge()}
						</CardTitle>
						<CardDescription>{getPlanDescription(subscription.plan_id)}</CardDescription>
					</div>
					<div className="text-right">
						<div className="text-2xl font-bold">
							{subscription.price > 0 ? formatCurrency(subscription.price) : t("common.free")}
						</div>
						{subscription.price > 0 && !isOneTime && (
							<div className="text-sm text-faint">{t(`pricing.${interval.perKey}`)}</div>
						)}
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-5">
				{usage && <UsageProgress usage={usage} t={t} />}

				{/* Plan Details */}
				<div className="grid grid-cols-2 gap-4 text-sm">
					<div>
						<span className="text-faint">{t("billing.status")}</span>
						<div className="mt-1 font-medium">
							{isExpired
								? t("billing.expired")
								: t(`billing.${subscription.status}`, {
										defaultValue: subscription.status,
									})}
						</div>
					</div>
					<div>
						<span className="text-faint">{t("billing.weekly_quota")}</span>
						<div className="mt-1 font-medium">
							{subscription.weekly_quota === -1
								? t("common.unlimited")
								: subscription.weekly_quota.toLocaleString()}{" "}
							{t("billing.queries")}
						</div>
					</div>
					{subscription.plan_id !== "hobby" && subscription.current_period_start && (
						<>
							<div>
								<span className="text-faint">{t("billing.current_period")}</span>
								<div className="mt-1 font-medium">
									{formatDate(subscription.current_period_start)} –{" "}
									{formatDate(subscription.current_period_end)}
								</div>
							</div>
							<div>
								<span className="text-faint">
									{isOneTime
										? t("billing.expires_on", {
												date: formatDate(subscription.current_period_end),
											})
										: t("billing.next_billing")}
								</span>
								{!isOneTime && (
									<div className="mt-1 font-medium">
										{subscription.cancel_at_period_end
											? t("billing.cancelled_at_end")
											: formatDate(subscription.current_period_end)}
									</div>
								)}
							</div>
						</>
					)}
				</div>

				{/* Actions */}
				{isOneTime ? (
					<div className="space-y-3 pt-1">
						<Modal>
							<ModalTrigger className="w-full px-4 py-2 rounded-lg text-center border border-default bg-transparent text-light hover:bg-secondary hover:border-border-light transition-all duration-200">
								{t("billing.buy_again")}
							</ModalTrigger>
							<PricingModal planName="Pro" defaultTab="one_time" />
						</Modal>
						{isExpired ? (
							<Modal>
								<ModalTrigger className="w-full px-4 py-2 rounded-lg text-center bg-brand text-white hover:bg-brand/90 shadow-lg hover:shadow-xl transition-all duration-200">
									{t("billing.upgrade_to_subscription")}
								</ModalTrigger>
								<PricingModal planName="Pro" />
							</Modal>
						) : (
							<p className="text-xs text-faint text-center">{t("billing.upgrade_after_expiry")}</p>
						)}
					</div>
				) : (
					subscription.stripe_customer_id && (
						<div className="pt-1">
							<Button
								onClick={handleManageSubscription}
								disabled={isManagingSubscription}
								className="w-full"
								variant="outline"
							>
								{isManagingSubscription ? t("billing.manage_opening") : t("billing.manage")}
							</Button>
							<p className="text-xs text-faint mt-2 text-center">{t("billing.manage_desc")}</p>
						</div>
					)
				)}
			</CardContent>
		</Card>
	);
}

function UsageProgress({ usage, t }: { usage: CurrentUsage; t: TFunction }) {
	const percent = usage.limit === -1 ? 0 : Math.min((usage.current_usage / usage.limit) * 100, 100);
	const color = percent >= 80 ? "bg-error" : percent >= 50 ? "bg-warning" : "bg-brand";

	return (
		<div className="rounded-lg bg-secondary/50 p-4 space-y-2.5">
			<div className="flex items-center justify-between text-sm">
				<span className="font-medium">{t("billing.queries_used")}</span>
				<span className="font-medium tabular-nums">
					{usage.current_usage.toLocaleString()} /{" "}
					{usage.limit === -1 ? t("common.unlimited") : usage.limit.toLocaleString()}
				</span>
			</div>
			<div className="w-full bg-background rounded-full h-2">
				<div
					className={`${color} h-2 rounded-full transition-all duration-500`}
					style={{ width: `${percent}%` }}
				/>
			</div>
			<div className="flex items-center justify-between text-xs text-faint">
				<span>{t("billing.remaining", { count: usage.remaining.toLocaleString() })}</span>
				<span>{t("billing.resets_on", { date: formatDate(usage.reset_at) })}</span>
			</div>
		</div>
	);
}
