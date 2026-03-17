import { IconCheck } from "@tabler/icons-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ModalBody, ModalContent, useModal } from "@/components/ui/animated-modal";
import { Button } from "@/components/ui/Button";
import { PRO_ONETIME_OPTIONS, PRO_PRICING_OPTIONS } from "@/constants/pricing";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import type { PaymentType, PricingOption } from "@/types/pricing";

interface PricingModalProps {
	planName: string;
}

const getDiscountBadgeColor = (index: number): string => {
	const colors = ["bg-warning", "bg-success", "bg-brand"];
	return colors[index] || "bg-success";
};

export function PricingModal({ planName }: PricingModalProps) {
	const { t } = useTranslation();
	const { setOpen } = useModal();
	const { isAuthenticated } = useAuth();
	const navigate = useNavigate();
	const [paymentType, setPaymentType] = useState<PaymentType>("subscription");
	const [selectedOption, setSelectedOption] = useState<PricingOption["id"]>("weekly");
	const [isLoading, setIsLoading] = useState(false);

	const options = paymentType === "subscription" ? PRO_PRICING_OPTIONS : PRO_ONETIME_OPTIONS;

	const handleTabChange = (type: PaymentType) => {
		setPaymentType(type);
		const firstOption = type === "subscription" ? PRO_PRICING_OPTIONS[0] : PRO_ONETIME_OPTIONS[0];
		setSelectedOption(firstOption.id);
	};

	const getPeriodText = (option: PricingOption): string => {
		if (option.interval === "week") return t("pricing.per_week");
		if (option.interval === "year") return t("pricing.per_year");
		if (option.months === 6) return t("pricing.per_6months");
		return t("pricing.per_month");
	};

	const getOptionLabel = (option: PricingOption): string => {
		const baseId = option.id.replace("onetime_", "");
		if (paymentType === "one_time") {
			return t(`pricing.onetime_${baseId}`);
		}
		return t(`pricing.${baseId}`);
	};

	const formatTotal = (option: PricingOption): string => {
		if (paymentType === "one_time") {
			return `$${option.price}`;
		}
		return `$${option.price} / ${getPeriodText(option)}`;
	};

	const selectedPricingOption = options.find((opt) => opt.id === selectedOption);

	const handleSubscribe = async () => {
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
			const response = await api.createCheckoutSession(selectedPricingOption.id);
			if (response.success && response.data?.url) {
				window.location.href = response.data.url;
			}
		} catch (error) {
			console.error("Error creating checkout session:", error);
		} finally {
			setIsLoading(false);
		}
	};

	const handleClose = () => {
		setOpen(false);
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

				{/* Payment Type Tabs */}
				<div className="flex rounded-lg border border-border p-1 bg-secondary">
					<button
						type="button"
						className={cn(
							"flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all",
							paymentType === "subscription"
								? "bg-background text-foreground shadow-sm"
								: "text-muted-foreground hover:text-foreground",
						)}
						onClick={() => handleTabChange("subscription")}
					>
						{t("pricing.tab_subscription")}
					</button>
					<button
						type="button"
						className={cn(
							"flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all",
							paymentType === "one_time"
								? "bg-background text-foreground shadow-sm"
								: "text-muted-foreground hover:text-foreground",
						)}
						onClick={() => handleTabChange("one_time")}
					>
						{t("pricing.tab_onetime")}
					</button>
				</div>

				{/* Pricing Options */}
				<div className="space-y-3">
					{options.map((option, index) => {
						const isSelected = selectedOption === option.id;
						const discountIndex = options.slice(0, index).filter((opt) => opt.discount).length;

						return (
							<div
								key={option.id}
								className={cn(
									"relative rounded-xl border-2 p-5 cursor-pointer transition-all",
									!isSelected && !option.popular && "border-border hover:border-border-light",
									isSelected && !option.popular && "border-brand bg-brand/10 shadow-lg",
									!isSelected && option.popular && "border-dashed border-yellow-400",
									isSelected && option.popular && "border-brand bg-brand/10 shadow-lg",
									!isSelected && "hover:bg-accent",
								)}
								onClick={() => setSelectedOption(option.id)}
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
											className={`w-5 h-5 rounded-full border-2 mr-4 flex items-center justify-center ${
												isSelected ? "border-brand bg-brand" : "border-border"
											}`}
										>
											{isSelected && <IconCheck className="w-3 h-3 text-white" />}
										</div>
										<div>
											<h3 className="font-semibold text-foreground text-lg">
												{getOptionLabel(option)}
											</h3>
											<p className="text-sm text-muted-foreground">{getPeriodText(option)}</p>
										</div>
									</div>
									<div className="text-right">
										<div className="text-3xl font-bold text-foreground tracking-wider">
											${option.price}
										</div>
										<div className="text-sm text-muted-foreground">{formatTotal(option)}</div>
									</div>
								</div>
							</div>
						);
					})}
				</div>

				{/* One-time note */}
				{paymentType === "one_time" && (
					<p className="text-xs text-muted-foreground text-center">{t("pricing.onetime_note")}</p>
				)}

				{/* Action Buttons */}
				<div className="flex gap-3 pt-5 border-t border-border">
					<Button variant="outline" onClick={handleClose} className="flex-1">
						{t("common.cancel")}
					</Button>
					<Button
						variant="primary"
						onClick={handleSubscribe}
						className="flex-1"
						disabled={!selectedPricingOption || isLoading}
						loading={isLoading}
					>
						{isLoading
							? t("common.processing")
							: paymentType === "one_time"
								? t("pricing.buy_now")
								: t("pricing.subscribe_now")}
					</Button>
				</div>
			</ModalContent>
		</ModalBody>
	);
}
