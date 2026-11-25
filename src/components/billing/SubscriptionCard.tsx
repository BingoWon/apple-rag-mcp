import { IconAlertTriangle } from "@tabler/icons-react";
import type { TFunction } from "i18next";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { PricingModal } from "@/components/sections/PricingModal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { formatCurrency, formatDateOnly, formatDateTimeWithZone } from "@/lib/utils";
import type { CurrentUsage, Subscription } from "@/types";
import { parseUTCDate } from "../../../shared/datetime";

interface SubscriptionCardProps {
	subscription: Subscription;
	usage?: CurrentUsage | null;
	quotaError?: string | null;
	onRetryQuota?: () => void;
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

const STATUS_I18N_KEY: Record<string, string> = {
	active: "billing.active",
	trialing: "billing.trial",
	canceled: "billing.cancelled",
	past_due: "billing.past_due",
	incomplete: "billing.incomplete",
	inactive: "billing.inactive",
	expired: "billing.expired",
};

const PLAN_LABELS: Record<string, string> = {
	hobby: "plans.hobby",
	pro: "plans.pro",
	enterprise: "plans.enterprise",
};

export function SubscriptionCard({
	subscription,
	usage,
	quotaError,
	onRetryQuota,
}: SubscriptionCardProps) {
	const { t, i18n } = useTranslation();
	const locale = i18n.resolvedLanguage ?? "en";
	const [isManagingSubscription, setIsManagingSubscription] = useState(false);

	const isOneTime = subscription.payment_type === "one_time";
	const periodEndDate = subscription.current_period_end
		? parseUTCDate(subscription.current_period_end)
		: null;
	const isExpired =
		subscription.status === "expired" ||
		(isOneTime && periodEndDate !== null && periodEndDate.getTime() < Date.now());
	const isPastDueOrIncomplete =
		!isOneTime &&
		(subscription.status === "past_due" || subscription.status === "incomplete") &&
		Boolean(subscription.has_active_stripe_subscription ?? subscription.stripe_customer_id);
	const isComplimentary =
		subscription.entitlement_source === "complimentary" ||
		(subscription.plan_id !== "hobby" &&
			subscription.status === "active" &&
			!isOneTime &&
			subscription.price <= 0 &&
			!subscription.stripe_customer_id);
	const isEnterprise = subscription.plan_id === "enterprise";
	const canManageBilling = Boolean(
		subscription.can_manage_billing ??
			(!isOneTime && subscription.stripe_customer_id && subscription.plan_id !== "hobby"),
	);

	const displayPlanId =
		(isExpired || isPastDueOrIncomplete) &&
		subscription.subscribed_plan_id &&
		subscription.subscribed_plan_id !== "hobby"
			? subscription.subscribed_plan_id
			: subscription.plan_id;

	const displayPlanName = t(PLAN_LABELS[displayPlanId] ?? "plans.hobby", {
		defaultValue: subscription.plan_name,
	});

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

	const statusLabel = isExpired
		? t("billing.expired")
		: t(STATUS_I18N_KEY[subscription.status] ?? "billing.inactive", {
				defaultValue: subscription.status,
			});

	const getStatusBadge = () => {
		if (isExpired) {
			return <Badge variant="secondary">{t("billing.expired")}</Badge>;
		}
		if (isComplimentary) {
			return <Badge variant="success">{t("billing.active")}</Badge>;
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
			case "inactive":
				return <Badge variant="secondary">{t("billing.inactive")}</Badge>;
			default:
				return <Badge variant="secondary">{statusLabel}</Badge>;
		}
	};

	const handleManageSubscription = async () => {
		setIsManagingSubscription(true);
		try {
			const response = await api.createBillingPortalSession();
			if (response.success && response.data?.url) {
				window.location.href = response.data.url;
			} else {
				toast.error(response.error?.message || t("billing.manage_error"));
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
			return `${displayPlanName} ${t(`pricing.${interval.passKey}`)}`;
		}
		if (displayPlanId === "hobby") {
			return displayPlanName;
		}
		return `${displayPlanName} ${t("billing.plan_suffix")}`;
	};

	const renderPriceHeader = () => {
		if (isEnterprise && subscription.price <= 0) {
			return (
				<>
					<div className="text-2xl font-bold text-foreground">{t("plans.price_custom")}</div>
					<div className="text-xs text-subtle mt-0.5">{t("billing.custom_billing")}</div>
				</>
			);
		}
		if (isComplimentary) {
			return (
				<>
					<div className="inline-flex items-center rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-sm font-semibold text-brand">
						{t("billing.complimentary")}
					</div>
					<div className="text-xs text-subtle mt-1">{t("billing.complimentary_desc")}</div>
				</>
			);
		}
		if (subscription.price > 0) {
			return (
				<>
					<div className="text-2xl font-bold tabular-nums text-foreground">
						{formatCurrency(subscription.price, subscription.currency, locale)}
					</div>
					{!isOneTime && (
						<div className="text-sm text-subtle">{t(`pricing.${interval.perKey}`)}</div>
					)}
				</>
			);
		}
		return <div className="text-2xl font-bold text-foreground">{t("common.free")}</div>;
	};

	const hasPeriodInfo = Boolean(
		(subscription.plan_id !== "hobby" || isExpired || isPastDueOrIncomplete) &&
			(subscription.current_period_start || subscription.current_period_end),
	);
	const numberFormat = new Intl.NumberFormat(locale);

	return (
		<Card>
			<CardHeader>
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div className="min-w-0">
						<CardTitle className="flex flex-wrap items-center gap-2">
							<span>{getPlanTitle()}</span>
							{getStatusBadge()}
						</CardTitle>
						<CardDescription className="mt-1">{getPlanDescription(displayPlanId)}</CardDescription>
					</div>
					<div className="text-left sm:text-right shrink-0">{renderPriceHeader()}</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-5">
				{isPastDueOrIncomplete && (
					<div
						role="alert"
						className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4"
					>
						<div className="flex items-start gap-2.5 text-sm">
							<IconAlertTriangle
								aria-hidden="true"
								className="mt-0.5 h-4 w-4 shrink-0 text-warning"
							/>
							<div>
								<p className="font-semibold text-foreground">{t("billing.past_due_title")}</p>
								<p className="mt-0.5 text-xs text-muted">{t("billing.past_due_desc")}</p>
							</div>
						</div>
						{canManageBilling && (
							<Button
								size="sm"
								variant="primary"
								loading={isManagingSubscription}
								onClick={handleManageSubscription}
								className="shrink-0"
							>
								{t("billing.update_payment")}
							</Button>
						)}
					</div>
				)}

				{usage ? (
					<UsageProgress usage={usage} locale={locale} t={t} />
				) : quotaError ? (
					<div
						role="alert"
						className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm"
					>
						<span className="text-destructive">{t("billing.quota_load_error")}</span>
						{onRetryQuota && (
							<Button size="sm" variant="outline" onClick={onRetryQuota}>
								{t("common.retry")}
							</Button>
						)}
					</div>
				) : null}

				{/* Plan Details */}
				<div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
					<div>
						<span className="text-subtle">{t("billing.status")}</span>
						<div className="mt-1 font-medium text-foreground">
							{isComplimentary ? `${statusLabel} · ${t("billing.complimentary")}` : statusLabel}
						</div>
					</div>
					<div>
						<span className="text-subtle">{t("billing.weekly_quota")}</span>
						<div className="mt-1 font-medium tabular-nums text-foreground">
							{subscription.weekly_quota === -1
								? t("common.unlimited")
								: `${numberFormat.format(subscription.weekly_quota)} ${t("billing.queries")}`}
						</div>
					</div>
					{subscription.minute_quota !== undefined && (
						<div>
							<span className="text-subtle">{t("billing.minute_quota")}</span>
							<div className="mt-1 font-medium tabular-nums text-foreground">
								{subscription.minute_quota === -1
									? t("common.unlimited")
									: t("plans.requests_per_minute", {
											count: subscription.minute_quota,
										})}
							</div>
						</div>
					)}
					{hasPeriodInfo && (
						<>
							<div>
								<span className="text-subtle">{t("billing.current_period")}</span>
								<div className="mt-1 font-medium text-foreground">
									{subscription.current_period_start
										? formatDateOnly(subscription.current_period_start, locale)
										: "—"}{" "}
									–{" "}
									{subscription.current_period_end
										? formatDateOnly(subscription.current_period_end, locale)
										: "—"}
								</div>
							</div>
							<div>
								<span className="text-subtle">
									{isOneTime
										? isExpired
											? t("billing.expired_on_label")
											: t("billing.expires_on_label")
										: t("billing.next_billing")}
								</span>
								<div className="mt-1 font-medium text-foreground">
									{isOneTime
										? subscription.current_period_end
											? formatDateOnly(subscription.current_period_end, locale)
											: "—"
										: subscription.cancel_at_period_end
											? t("billing.cancelled_at_end")
											: subscription.current_period_end
												? formatDateOnly(subscription.current_period_end, locale)
												: "—"}
								</div>
							</div>
						</>
					)}
				</div>

				{/* Actions */}
				{isOneTime ? (
					<div className="space-y-3 pt-1">
						<PricingModal defaultTab="one_time">
							<Button className="w-full" variant="outline">
								{t("billing.buy_again")}
							</Button>
						</PricingModal>
						{isExpired ? (
							<PricingModal defaultTab="subscription">
								<Button className="w-full" variant="primary">
									{t("billing.upgrade_to_subscription")}
								</Button>
							</PricingModal>
						) : (
							<p className="text-xs text-subtle text-center">{t("billing.upgrade_after_expiry")}</p>
						)}
					</div>
				) : (
					canManageBilling && (
						<div className="pt-1">
							<Button
								onClick={handleManageSubscription}
								disabled={isManagingSubscription}
								loading={isManagingSubscription}
								className="w-full"
								variant="outline"
							>
								{isManagingSubscription ? t("billing.manage_opening") : t("billing.manage")}
							</Button>
							<p className="text-xs text-subtle mt-2 text-center">{t("billing.manage_desc")}</p>
						</div>
					)
				)}
			</CardContent>
		</Card>
	);
}

function UsageProgress({
	usage,
	locale,
	t,
}: {
	usage: CurrentUsage;
	locale: string;
	t: TFunction;
}) {
	const isUnlimited = usage.limit === -1;
	const percent =
		isUnlimited || usage.limit <= 0 ? 0 : Math.min((usage.current_usage / usage.limit) * 100, 100);
	const color = percent >= 80 ? "bg-destructive" : percent >= 50 ? "bg-warning" : "bg-brand";
	const numberFormat = new Intl.NumberFormat(locale);

	return (
		<div className="rounded-lg border border-border/60 bg-surface/60 p-4 space-y-2.5">
			<div className="flex items-center justify-between text-sm">
				<span className="font-medium text-foreground">{t("billing.queries_used")}</span>
				<span className="font-medium tabular-nums text-foreground">
					{numberFormat.format(usage.current_usage)} /{" "}
					{isUnlimited ? t("common.unlimited") : numberFormat.format(usage.limit)}
				</span>
			</div>
			{!isUnlimited && (
				<div className="w-full bg-background rounded-full h-2 overflow-hidden">
					<div
						className={`${color} h-2 rounded-full transition-all duration-500`}
						style={{ width: `${percent}%` }}
					/>
				</div>
			)}
			<div className="flex flex-wrap items-center justify-between gap-2 text-xs text-subtle">
				<span>
					{isUnlimited
						? t("common.unlimited")
						: t("billing.remaining", { count: numberFormat.format(usage.remaining) })}
				</span>
				<span>
					{t("billing.resets_on", { date: formatDateTimeWithZone(usage.reset_at, locale) })}
				</span>
			</div>
		</div>
	);
}
