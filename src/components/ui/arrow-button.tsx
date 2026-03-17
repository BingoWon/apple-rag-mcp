import { IconArrowRight } from "@tabler/icons-react";
import type React from "react";
import { useTranslation } from "react-i18next";

interface ArrowButtonProps {
	className?: string;
}

export const ArrowButton: React.FC<ArrowButtonProps> = ({ className = "" }) => {
	const { t } = useTranslation();
	return (
		<a href="/register" className="inline-block">
			<button
				className={`arrow-button relative bg-brand-secondary text-white font-medium px-5 py-2 text-lg font-medium rounded-xl border-none tracking-wide flex items-center overflow-hidden h-12 pr-14 cursor-pointer shadow-[inset_0_0_1.6em_-0.6em_hsl(var(--brand-dark))] hover:scale-105 active:scale-95 group ${className}`}
			>
				<span className="relative z-10">{t("common.get_started")}</span>

				{/* Arrow Icon Container */}
				<div className="icon absolute right-2 bg-white ml-4 flex items-center justify-center h-9 w-9 rounded-lg shadow-[inset_0_0_1.6em_-0.6em_hsl(var(--brand-dark))] group-hover:w-[calc(100%-1rem)] z-20 transition-all duration-300">
					<IconArrowRight className="w-5 h-5 text-brand group-hover:translate-x-1" />
				</div>
			</button>
		</a>
	);
};
