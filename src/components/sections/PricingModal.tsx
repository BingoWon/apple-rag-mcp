import { IconCreditCard } from "@tabler/icons-react";
import Alipay from "@thesvg/react/alipay";
import { type ReactElement, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/Dialog";
import { PRO_ONETIME_OPTIONS, PRO_PRICING_OPTIONS } from "@/constants/pricing";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { useDashboardStore } from "@/stores/dashboard";
import type { PaymentType, PricingOption } from "@/types/pricing";

interface PricingModalProps {
	children: ReactElement;
	defaultTab?: PaymentType;
}

const CONFLICT_MESSAGES: Record<string, string> = {
	CONFLICT_SUBSCRIPTION_ACTIVE: "pricing.conflict_subscription_active",
	CHECKOUT_PENDING: "pricing.checkout_pending",
	CONFLICT_ONETIME_ACTIVE: "pricing.conflict_onetime_active",
};

export function PricingModal({ children, defaultTab = "subscription" }: PricingModalProps) {
	const { t } = useTranslation();

	const { isAuthenticated } = useAuth();
	const navigate = useNavigate();
	const subscription = useDashboardStore((s) => s.subscription);

	const [selectedOption, setSelectedOption] = useState<PricingOption["id"]>(
		defaultTab === "one_time" ? "onetime_monthly" : "weekly",
	);
	const [isLoading, setIsLoading] = useState(false);

	const isOneTime = selectedOption.startsWith("onetime_");
	const paymentType = isOneTime ? "one_time" : "subscription";
	const options = isOneTime ? PRO_ONETIME_OPTIONS : PRO_PRICING_OPTIONS;

	const hasActiveSubscription =
		subscription?.payment_type === "subscription" &&
		subscription?.status === "active" &&
		subscription?.plan_id !== "hobby";
	const hasActiveOneTime =
		subscription?.payment_type === "one_time" &&
		subscription?.current_period_end &&
		new Date(subscription.current_period_end) > new Date();

	const subscriptionTabDisabled = !!hasActiveOneTime;
	const onetimeTabDisabled = !!hasActiveSubscription;

	const handleTabChange = (type: PaymentType) => {
		if (type === "subscription" && subscriptionTabDisabled) return;
		if (type === "one_time" && onetimeTabDisabled) return;

		setSelectedOption(type === "one_time" ? "onetime_monthly" : "weekly");
	};

	const handleCheckout = async (paymentMethod?: "card" | "alipay") => {
		if (isLoading || (isOneTime ? onetimeTabDisabled : subscriptionTabDisabled)) return;

		if (!isAuthenticated) {
			toast.error(t("pricing.login_required"));

			navigate("/login/");
			return;
		}

		setIsLoading(true);

		try {
			const { api } = await import("@/lib/api");
			const response = await api.createCheckoutSession(selectedOption, paymentMethod);
			if (response.success && response.data?.url) {
				window.location.href = response.data.url;
			} else {
				const conflictKey = CONFLICT_MESSAGES[response.error?.message || ""];
				toast.error(conflictKey ? t(conflictKey) : response.error?.message || "Unknown error");
			}
		} catch (error) {
			console.error("Error creating checkout session:", error);
			toast.error(t("billing.manage_error"));
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Dialog>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent className="max-w-lg space-y-4 p-4 sm:p-6">
				<DialogHeader>
					<DialogTitle>{t("pricing.choose_plan", { plan: "Pro" })}</DialogTitle>
					<DialogDescription>{t("pricing.choose_cycle")}</DialogDescription>
				</DialogHeader>
				<div className="flex gap-1 rounded-lg border border-default bg-secondary p-1">
					{(["subscription", "one_time"] as const).map((type) => {
						const recurring = type === "subscription";
						return (
							<Button
								key={type}
								variant={paymentType === type ? "primary" : "ghost"}
								className="h-auto flex-1 whitespace-normal"
								aria-pressed={paymentType === type}
								disabled={isLoading || (recurring ? subscriptionTabDisabled : onetimeTabDisabled)}
								title={
									recurring && subscriptionTabDisabled
										? t("pricing.tab_disabled_has_onetime")
										: !recurring && onetimeTabDisabled
											? t("pricing.tab_disabled_has_subscription")
											: undefined
								}
								onClick={() => handleTabChange(type)}
							>
								{t(recurring ? "pricing.tab_subscription" : "pricing.tab_onetime")}
							</Button>
						);
					})}
				</div>
				<fieldset className="space-y-2" disabled={isLoading}>
					<legend className="sr-only">{t("pricing.choose_cycle")}</legend>
					{options.map((option) => (
						<label
							key={option.id}
							className={cn(
								"flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 focus-within:ring-2 focus-within:ring-action",
								selectedOption === option.id ? "border-action bg-action/5" : "border-default",
							)}
						>
							<input
								type="radio"
								name="billing-period"
								value={option.id}
								checked={selectedOption === option.id}
								onChange={() => setSelectedOption(option.id)}
								className="accent-action"
							/>
							<span className="min-w-0 flex-1">
								<span className="block font-semibold">{t(`pricing.${option.id}`)}</span>
								{option.popular && (
									<span className="block text-xs text-muted">{t("pricing.most_popular")}</span>
								)}
							</span>
							<span className="text-right">
								<strong className="block text-lg tabular-nums">${option.price}</strong>
								<span className="block text-xs text-muted">
									{t(`pricing.${option.subtitleKey}`)}
								</span>
								{option.discount && (
									<span className="block text-xs text-muted">
										{t("pricing.discount", { percent: option.discount.replace(/[^0-9]/g, "") })}
									</span>
								)}
							</span>
						</label>
					))}
				</fieldset>
				{isOneTime && <p className="text-sm text-muted">{t("pricing.onetime_note")}</p>}
				<div className="flex flex-wrap justify-end gap-2 border-t border-default pt-4">
					<DialogClose asChild>
						<Button variant="outline">{t("common.cancel")}</Button>
					</DialogClose>
					{isOneTime && (
						<Button variant="outline" disabled={isLoading} onClick={() => handleCheckout("alipay")}>
							<Alipay aria-hidden="true" variant="mono" className="size-4" />
							{t("pricing.pay_alipay")}
						</Button>
					)}
					<Button
						variant="primary"
						disabled={isLoading}
						onClick={() => handleCheckout(isOneTime ? "card" : undefined)}
					>
						<IconCreditCard aria-hidden="true" className="size-4" />
						{t(
							isLoading
								? "common.processing"
								: isOneTime
									? "pricing.pay_card"
									: hasActiveSubscription
										? "pricing.manage_subscription"
										: "pricing.subscribe_now",
						)}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
