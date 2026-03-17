import { IconCheck } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ModalBody, ModalContent, useModal } from "@/components/ui/animated-modal";
import { Button } from "@/components/ui/Button";
import { PRO_PRICING_OPTIONS } from "@/constants/pricing";
import { cn } from "@/lib/utils";
import type { PricingOption } from "@/types/pricing";

interface PricingModalProps {
	planName: string;
}

const getDiscountBadgeColor = (index: number): string => {
	const colors = [
		"bg-warning", // 第一个：黄色
		"bg-success", // 第二个：绿色
		"bg-brand", // 第三个：品牌色
	];
	return colors[index] || "bg-success"; // 默认绿色
};

export function PricingModal({ planName }: PricingModalProps) {
	const { t } = useTranslation();
	const { setOpen } = useModal();
	const [selectedOption, setSelectedOption] = useState<PricingOption["id"]>("weekly");
	const [isLoading, setIsLoading] = useState(false);

	const getPeriodText = (option: PricingOption): string => {
		if (option.interval === "week") return t("pricing.per_week");
		if (option.interval === "year") return t("pricing.per_year");
		if (option.months === 6) return t("pricing.per_6months");
		return t("pricing.per_month");
	};

	const formatTotal = (option: PricingOption): string => {
		return `$${option.price} / ${getPeriodText(option)}`;
	};

	const selectedPricingOption = PRO_PRICING_OPTIONS.find((opt) => opt.id === selectedOption);

	const handleSubscribe = async () => {
		if (!selectedPricingOption) return;

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

				{/* Pricing Options */}
				<div className="space-y-3">
					{PRO_PRICING_OPTIONS.map((option, index) => {
						const isSelected = selectedOption === option.id;
						// 计算折扣标签的索引（只计算有折扣的项目）
						const discountIndex = PRO_PRICING_OPTIONS.slice(0, index).filter(
							(opt) => opt.discount,
						).length;

						return (
							<div
								key={option.id}
								className={cn(
									"relative rounded-xl border-2 p-5 cursor-pointer transition-all",
									// 基础边框样式
									!isSelected && !option.popular && "border-border hover:border-border-light",
									// 选中状态样式
									isSelected && !option.popular && "border-brand bg-brand/10 shadow-lg",
									// Popular 样式（未选中）
									!isSelected && option.popular && "border-dashed border-yellow-400",
									// Popular + 选中状态组合样式（选中时使用实线）
									isSelected && option.popular && "border-brand bg-brand/10 shadow-lg",
									// 悬浮背景（非选中状态）
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
										{t("pricing.discount", { percent: option.discount?.replace(/[^0-9]/g, "") })}
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
												{t(`pricing.${option.id}`)}
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
						{isLoading ? t("common.processing") : t("pricing.subscribe_now")}
					</Button>
				</div>
			</ModalContent>
		</ModalBody>
	);
}
