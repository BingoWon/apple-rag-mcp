import "./PricingModal.css";
import { IconCreditCard, IconLock } from "@tabler/icons-react";
import Alipay from "@thesvg/react/alipay";
import { spring } from "motion";
import { type CSSProperties, type ReactElement, useState } from "react";
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

const panelMotion = {
	"--pricing-spring": String(spring({ keyframes: [0, 1], stiffness: 260, damping: 15 })),
} as CSSProperties;
const discountColors: Partial<Record<PricingOption["id"], string>> = {
	monthly: "bg-warning",
	semiannual: "bg-success",
	annual: "bg-brand",
};

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
			<DialogContent
				style={panelMotion}
				className="pricing-dialog max-w-2xl space-y-4 bg-card/95 p-4 shadow-[var(--shadow-complex)] backdrop-blur-xl sm:space-y-6 sm:p-8 md:rounded-3xl md:p-10"
			>
				<DialogHeader className="px-6 text-center">
					<DialogTitle className="text-2xl">
						{t("pricing.choose_plan", { plan: "Pro" })}
					</DialogTitle>
					<DialogDescription>{t("pricing.choose_cycle")}</DialogDescription>
				</DialogHeader>
				<div className="flex gap-1 rounded-lg border border-default bg-secondary p-1">
					{(["subscription", "one_time"] as const).map((type) => {
						const recurring = type === "subscription";
						const locked = recurring ? subscriptionTabDisabled : onetimeTabDisabled;
						return (
							<Button
								key={type}
								variant="ghost"
								className={cn(
									"h-auto min-w-0 flex-1 gap-1.5 whitespace-normal rounded-lg px-2 py-2.5",
									paymentType === type &&
										(recurring
											? "bg-[#635BFF] text-white hover:bg-[#554cde]"
											: "bg-[#146bdc] text-white hover:bg-[#105ebf]"),
								)}
								aria-pressed={paymentType === type}
								disabled={isLoading || locked}
								title={
									recurring && subscriptionTabDisabled
										? t("pricing.tab_disabled_has_onetime")
										: !recurring && onetimeTabDisabled
											? t("pricing.tab_disabled_has_subscription")
											: undefined
								}
								onClick={() => handleTabChange(type)}
							>
								{locked ? (
									<IconLock aria-hidden="true" className="size-4 shrink-0" />
								) : (
									<>
										<IconCreditCard aria-hidden="true" className="size-4 shrink-0" />
										{!recurring && (
											<Alipay aria-hidden="true" variant="mono" className="size-4 shrink-0" />
										)}
									</>
								)}
								{t(recurring ? "pricing.tab_subscription" : "pricing.tab_onetime")}
							</Button>
						);
					})}
				</div>
				<fieldset className="min-w-0 space-y-3" disabled={isLoading}>
					<legend className="sr-only">{t("pricing.choose_cycle")}</legend>
					{options.map((option) => (
						<label
							key={option.id}
							className={cn(
								"relative flex cursor-pointer items-center gap-3 rounded-xl border-2 px-3 py-3 focus-within:ring-2 focus-within:ring-action sm:p-5",
								selectedOption === option.id
									? "border-action bg-action/10 shadow-lg"
									: option.popular
										? "border-dashed border-yellow-400"
										: "border-default hover:bg-accent",
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
									<span className="absolute left-3 top-0 -translate-y-1/2 rounded-full bg-yellow-500 px-2.5 py-0.5 text-xs font-semibold text-slate-950 shadow-sm">
										{t("pricing.most_popular")}
									</span>
								)}
							</span>
							<span className="text-right">
								<strong className="block text-xl tabular-nums sm:text-3xl">${option.price}</strong>
								<span className="block text-xs text-muted">
									{t(`pricing.${option.subtitleKey}`)}
								</span>
								{option.discount && (
									<span
										className={cn(
											"absolute right-3 top-0 -translate-y-1/2 rounded-full px-2.5 py-0.5 text-xs font-semibold text-slate-950 shadow-sm",
											discountColors[option.id] ?? "bg-success",
										)}
									>
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
						<Button variant="outline" className="flex-1">
							{t("common.cancel")}
						</Button>
					</DialogClose>
					{isOneTime && (
						<Button
							variant="primary"
							className="flex-1 bg-[#146bdc] text-white"
							disabled={isLoading}
							onClick={() => handleCheckout("alipay")}
						>
							<Alipay aria-hidden="true" variant="mono" className="size-4" />
							{t("pricing.pay_alipay")}
						</Button>
					)}
					<Button
						variant="primary"
						className="flex-1 bg-[#635BFF] text-white"
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
