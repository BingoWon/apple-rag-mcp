import { IconBrandAlipay, IconCheck, IconCreditCard, IconLock } from "@tabler/icons-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ModalBody, ModalContent, useModal } from "@/components/ui/animated-modal";
import { Button } from "@/components/ui/Button";
import { PRO_ONETIME_OPTIONS, PRO_PRICING_OPTIONS } from "@/constants/pricing";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { useDashboardStore } from "@/stores/dashboard";
import type { PaymentType, PricingOption } from "@/types/pricing";

interface PricingModalProps {
	planName: string;
	defaultTab?: PaymentType;
}

const getDiscountBadgeColor = (index: number): string => {
	const colors = ["bg-warning", "bg-success", "bg-brand"];
	return colors[index] || "bg-success";
};

const CONFLICT_MESSAGES: Record<string, string> = {
	CONFLICT_SUBSCRIPTION_ACTIVE: "pricing.conflict_subscription_active",
	CONFLICT_ONETIME_ACTIVE: "pricing.conflict_onetime_active",
};

export function PricingModal({ planName, defaultTab = "subscription" }: PricingModalProps) {
	const { t } = useTranslation();
	const { setOpen } = useModal();
	const { isAuthenticated } = useAuth();
	const navigate = useNavigate();
	const subscription = useDashboardStore((s) => s.subscription);
	const [paymentType, setPaymentType] = useState<PaymentType>(defaultTab);
	const [selectedOption, setSelectedOption] = useState<PricingOption["id"]>(
		defaultTab === "one_time" ? "onetime_monthly" : "weekly",
	);
	const [isLoading, setIsLoading] = useState(false);

	const isOneTime = paymentType === "one_time";
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
		setPaymentType(type);
		setSelectedOption(type === "one_time" ? "onetime_monthly" : "weekly");
	};

	const getSubtitle = (option: PricingOption) => t(`pricing.${option.subtitleKey}`);

	const getOptionLabel = (option: PricingOption): string => {
		const baseId = option.id.replace("onetime_", "");
		return isOneTime ? t(`pricing.onetime_${baseId}`) : t(`pricing.${baseId}`);
	};

	const selectedPricingOption = options.find((opt) => opt.id === selectedOption);

	const handleCheckout = async (paymentMethod?: "card" | "alipay") => {
		if (!selectedPricingOption) return;

		if (!isAuthenticated) {
			toast.error(t("pricing.login_required"));
			setOpen(false);
			navigate("/login/");
			return;
		}

		setIsLoading(true);

		try {
			const { api } = await import("@/lib/api");
			const response = await api.createCheckoutSession(selectedPricingOption.id, paymentMethod);
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
		<ModalBody className="max-w-2xl">
			<ModalContent className="space-y-6">
				{/* Header */}
				<div className="text-center">
					<h2 className="text-2xl font-semibold text-foreground">
						{t("pricing.choose_plan", { plan: planName })}
					</h2>
					<p className="text-sm text-muted-foreground mt-2">{t("pricing.choose_cycle")}</p>
				</div>

				{/* Payment Type Toggle */}
				<div className="flex gap-1 rounded-xl bg-secondary p-1">
					<button
						type="button"
						disabled={subscriptionTabDisabled}
						title={subscriptionTabDisabled ? t("pricing.tab_disabled_has_onetime") : undefined}
						className={cn(
							"flex-1 py-2.5 px-4 text-sm font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5",
							subscriptionTabDisabled && "opacity-40 cursor-not-allowed",
							!subscriptionTabDisabled &&
								!isOneTime &&
								"bg-[#635BFF] text-white shadow-sm",
							!subscriptionTabDisabled &&
								isOneTime &&
								"text-muted-foreground hover:text-foreground hover:bg-accent",
						)}
						onClick={() => handleTabChange("subscription")}
					>
						{subscriptionTabDisabled ? (
							<IconLock className="w-3.5 h-3.5" />
						) : (
							<IconCreditCard className="w-4 h-4" />
						)}
						{t("pricing.tab_subscription")}
					</button>
					<button
						type="button"
						disabled={onetimeTabDisabled}
						title={onetimeTabDisabled ? t("pricing.tab_disabled_has_subscription") : undefined}
						className={cn(
							"flex-1 py-2.5 px-4 text-sm font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5",
							onetimeTabDisabled && "opacity-40 cursor-not-allowed",
							!onetimeTabDisabled &&
								isOneTime &&
								"bg-[#1677FF] text-white shadow-sm",
							!onetimeTabDisabled &&
								!isOneTime &&
								"text-muted-foreground hover:text-foreground hover:bg-accent",
						)}
						onClick={() => handleTabChange("one_time")}
					>
						{onetimeTabDisabled ? (
							<IconLock className="w-3.5 h-3.5" />
						) : (
							<IconBrandAlipay className="w-4 h-4" />
						)}
						{t("pricing.tab_onetime")}
					</button>
				</div>

				{/* Pricing Options */}
				<div className="space-y-3">
					{options.map((option, index) => {
						const isSelected = selectedOption === option.id;
						const discountIndex = options.slice(0, index).filter((opt) => opt.discount).length;

						const handleOptionKeyDown = (e: React.KeyboardEvent) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								setSelectedOption(option.id);
							}
						};
						return (
							// biome-ignore lint/a11y/useSemanticElements: complex card layout with nested badges and price display
							<div
								key={option.id}
								role="button"
								tabIndex={0}
								className={cn(
									"relative rounded-xl border-2 p-5 cursor-pointer transition-all",
									!isSelected && !option.popular && "border-border hover:border-border-light",
									isSelected && !option.popular && "border-brand bg-brand/10 shadow-lg",
									!isSelected && option.popular && "border-dashed border-yellow-400",
									isSelected && option.popular && "border-brand bg-brand/10 shadow-lg",
									!isSelected && "hover:bg-accent",
								)}
								onClick={() => setSelectedOption(option.id)}
								onKeyDown={handleOptionKeyDown}
							>
								{option.popular && (
									<span className="absolute top-0 left-4 -translate-y-1/2 z-10 bg-yellow-500 text-white px-3 py-1 text-xs font-semibold rounded-full whitespace-nowrap shadow-lg">
										{t("pricing.most_popular")}
									</span>
								)}

								{option.discount && (
									<span
										className={`absolute top-0 right-4 -translate-y-1/2 z-10 ${getDiscountBadgeColor(discountIndex)} text-white px-3 py-1 text-xs font-semibold rounded-full whitespace-nowrap shadow-lg`}
									>
										{t("pricing.discount", {
											percent: option.discount?.replace(/[^0-9]/g, ""),
										})}
									</span>
								)}

								<div className="flex items-center justify-between">
									<div className="flex items-center">
										<div
											className={cn(
												"w-5 h-5 rounded-full border-2 mr-4 flex items-center justify-center transition-colors",
												isSelected ? "border-brand bg-brand" : "border-border",
											)}
										>
											{isSelected && <IconCheck className="w-3 h-3 text-white" />}
										</div>
										<div>
											<h3 className="font-semibold text-foreground text-lg">
												{getOptionLabel(option)}
											</h3>
											<p className="text-sm text-muted-foreground">{getSubtitle(option)}</p>
										</div>
									</div>
									<div className="text-right">
										<div className="text-3xl font-bold text-foreground tracking-wider">
											${option.price}
										</div>
										{isOneTime ? (
											<div className="text-sm text-muted-foreground">
												{t("pricing.onetime_note")}
											</div>
										) : (
											<div className="text-sm text-muted-foreground">
												${option.price} / {getSubtitle(option)}
											</div>
										)}
									</div>
								</div>
							</div>
						);
					})}
				</div>

				{/* Action Buttons */}
				<div className="flex gap-3 pt-5 border-t border-border">
					<Button variant="outline" onClick={() => setOpen(false)} className="flex-1">
						{t("common.cancel")}
					</Button>
					{isOneTime ? (
						<>
							<button
								type="button"
								onClick={() => handleCheckout("alipay")}
								disabled={!selectedPricingOption || isLoading}
								className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-white bg-[#1677FF] hover:bg-[#1677FF]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
							>
								<IconBrandAlipay className="w-4 h-4" />
								{t("pricing.pay_alipay")}
							</button>
							<button
								type="button"
								onClick={() => handleCheckout("card")}
								disabled={!selectedPricingOption || isLoading}
								className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-white bg-[#635BFF] hover:bg-[#635BFF]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
							>
								<IconCreditCard className="w-4 h-4" />
								{t("pricing.pay_card")}
							</button>
						</>
					) : (
						<button
							type="button"
							onClick={() => handleCheckout()}
							disabled={!selectedPricingOption || isLoading}
							className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-white bg-[#635BFF] hover:bg-[#635BFF]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						>
							<IconCreditCard className="w-4 h-4" />
							{isLoading ? t("common.processing") : t("pricing.subscribe_now")}
						</button>
					)}
				</div>
			</ModalContent>
		</ModalBody>
	);
}
