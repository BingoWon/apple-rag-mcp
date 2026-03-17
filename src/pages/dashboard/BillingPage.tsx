import {
	IconChartBar,
	IconCreditCard,
	IconInfoCircle,
	IconRocket,
} from "@tabler/icons-react";
import { Suspense, useEffect, useMemo, useRef } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { SubscriptionCard } from "@/components/billing/SubscriptionCard";
import { PricingSection } from "@/components/sections/PricingSection";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn, formatDate } from "@/lib/utils";
import { useDashboardStore } from "@/stores/dashboard";

function UsageProgressBar({ percentage }: { percentage: number }) {
	const color = percentage >= 90 ? "bg-error" : percentage >= 70 ? "bg-warning" : "bg-brand";

	return (
		<div className="w-full bg-tertiary rounded-full h-2.5 overflow-hidden">
			<div
				className={cn("h-full rounded-full transition-all duration-500 ease-out", color)}
				style={{ width: `${Math.min(percentage, 100)}%` }}
			/>
		</div>
	);
}

function UsageCard() {
	const { t } = useTranslation();
	const { currentUsage, isLoadingQuota } = useDashboardStore();

	if (isLoadingQuota) {
		return (
			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<IconChartBar className="h-5 w-5 text-brand" />
						<CardTitle>{t("billing.current_usage")}</CardTitle>
					</div>
					<CardDescription>{t("billing.usage_desc")}</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-4 animate-pulse">
						<div className="flex justify-between">
							<div className="h-4 bg-tertiary rounded w-24" />
							<div className="h-4 bg-tertiary rounded w-20" />
						</div>
						<div className="h-2.5 bg-tertiary rounded-full" />
						<div className="flex justify-between">
							<div className="h-3 bg-tertiary rounded w-28" />
							<div className="h-3 bg-tertiary rounded w-32" />
						</div>
					</div>
				</CardContent>
			</Card>
		);
	}

	if (!currentUsage) {
		return (
			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<IconChartBar className="h-5 w-5 text-brand" />
						<CardTitle>{t("billing.current_usage")}</CardTitle>
					</div>
				</CardHeader>
				<CardContent>
					<div className="flex items-center gap-3 text-faint">
						<IconInfoCircle className="h-5 w-5 shrink-0" />
						<p className="text-sm">{t("billing.no_usage_data")}</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	const percentage =
		currentUsage.limit === -1
			? 0
			: Math.min((currentUsage.current_usage / currentUsage.limit) * 100, 100);

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-2">
					<IconChartBar className="h-5 w-5 text-brand" />
					<CardTitle>{t("billing.current_usage")}</CardTitle>
				</div>
				<CardDescription>{t("billing.usage_desc")}</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<span className="text-sm font-medium text-muted">{t("billing.queries_used")}</span>
						<span className="text-sm font-semibold text-light">
							{currentUsage.current_usage.toLocaleString()} /{" "}
							{currentUsage.limit === -1
								? t("common.unlimited")
								: currentUsage.limit.toLocaleString()}
						</span>
					</div>
					<div className="space-y-1.5">
						<UsageProgressBar percentage={percentage} />
						{currentUsage.limit !== -1 && (
							<p className="text-xs text-faint text-right">
								{t("billing.usage_percent", { percent: Math.round(percentage) })}
							</p>
						)}
					</div>
					<div className="flex items-center justify-between text-sm text-faint">
						<span>
							{t("billing.remaining", {
								count: currentUsage.remaining.toLocaleString(),
							})}
						</span>
						<span>{t("billing.resets_on", { date: formatDate(currentUsage.reset_at) })}</span>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

function SubscriptionSection() {
	const { t } = useTranslation();
	const { subscription, isLoadingSubscription } = useDashboardStore();

	if (isLoadingSubscription) {
		return (
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div className="space-y-2 animate-pulse">
							<div className="h-5 bg-tertiary rounded w-40" />
							<div className="h-4 bg-tertiary rounded w-64" />
						</div>
						<div className="animate-pulse">
							<div className="h-8 bg-tertiary rounded w-16" />
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-2 gap-4 animate-pulse">
						<div className="space-y-2">
							<div className="h-3 bg-tertiary rounded w-16" />
							<div className="h-4 bg-tertiary rounded w-20" />
						</div>
						<div className="space-y-2">
							<div className="h-3 bg-tertiary rounded w-24" />
							<div className="h-4 bg-tertiary rounded w-20" />
						</div>
					</div>
				</CardContent>
			</Card>
		);
	}

	if (!subscription) {
		return (
			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<IconCreditCard className="h-5 w-5 text-brand" />
						<CardTitle>{t("billing.your_plan")}</CardTitle>
					</div>
				</CardHeader>
				<CardContent>
					<div className="flex flex-col items-center gap-4 py-4 text-center">
						<IconRocket className="h-10 w-10 text-faint" />
						<p className="text-sm text-faint max-w-sm">{t("billing.no_subscription")}</p>
						<Link to="/#pricing">
							<Button variant="primary">{t("pricing.upgrade")}</Button>
						</Link>
					</div>
				</CardContent>
			</Card>
		);
	}

	return <SubscriptionCard subscription={subscription} />;
}

function BillingPageContent() {
	const { t } = useTranslation();
	const [searchParams] = useSearchParams();
	const { subscription, fetchSubscription, fetchCurrentUsage } = useDashboardStore();

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

	const showUpgrade = useMemo(
		() => subscription?.plan_id === "hobby",
		[subscription?.plan_id],
	);

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold text-light">{t("billing.title")}</h1>
				<p className="mt-1 text-sm text-muted">{t("billing.subtitle")}</p>
			</div>

			<UsageCard />
			<SubscriptionSection />
			{showUpgrade && <PricingSection />}
		</div>
	);
}

export default function BillingPage() {
	return (
		<Suspense fallback={<div />}>
			<BillingPageContent />
		</Suspense>
	);
}
