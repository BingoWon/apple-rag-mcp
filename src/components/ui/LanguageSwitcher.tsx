import { IconLanguage } from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const LANGUAGES = [
	{ code: "en", name: "English" },
	{ code: "zh", name: "简体中文" },
] as const;

interface LanguageSwitcherProps {
	className?: string;
	variant?: "icon" | "dropdown";
	placement?: "top" | "bottom";
}

export function LanguageSwitcher({
	className,
	variant = "icon",
	placement = "bottom",
}: LanguageSwitcherProps) {
	const { i18n } = useTranslation();
	const [isHovered, setIsHovered] = useState(false);
	const [isClicking, setIsClicking] = useState(false);
	const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	useEffect(() => {
		return () => {
			if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
		};
	}, []);

	const handleMouseEnter = useCallback(() => {
		if (isClicking) return;
		if (hideTimeoutRef.current) {
			clearTimeout(hideTimeoutRef.current);
			hideTimeoutRef.current = null;
		}
		setIsHovered(true);
	}, [isClicking]);

	const handleMouseLeave = useCallback(() => {
		hideTimeoutRef.current = setTimeout(() => setIsHovered(false), 150);
	}, []);

	const handleSelect = useCallback(
		(code: string) => {
			i18n.changeLanguage(code);
			setIsHovered(false);
			if (hideTimeoutRef.current) {
				clearTimeout(hideTimeoutRef.current);
				hideTimeoutRef.current = null;
			}
		},
		[i18n],
	);

	const handleCycle = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();
			setIsClicking(true);
			setIsHovered(false);
			if (hideTimeoutRef.current) {
				clearTimeout(hideTimeoutRef.current);
				hideTimeoutRef.current = null;
			}
			const currentIndex = LANGUAGES.findIndex((l) => l.code === i18n.language);
			const nextIndex = (currentIndex + 1) % LANGUAGES.length;
			i18n.changeLanguage(LANGUAGES[nextIndex].code);
			setTimeout(() => setIsClicking(false), 200);
		},
		[i18n],
	);

	if (variant === "icon") {
		return (
			<div
				className="relative flex items-center"
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
				onClick={(e) => e.stopPropagation()}
			>
				<Button
					size="icon"
					variant="ghost"
					className={cn("relative", className)}
					onClick={handleCycle}
					title={i18n.language === "zh" ? "简体中文" : "English"}
				>
					<IconLanguage className="h-4 w-4" />
					<span className="sr-only">Language</span>
				</Button>

				<div
					className={cn(
						"absolute left-1/2 transform -translate-x-1/2 p-1 z-50",
						"bg-background border border-default rounded-lg shadow-lg",
						"min-w-[120px] py-1",
						"transition-all duration-200 ease-out",
						placement === "top"
							? "bottom-full mb-1 before:content-[''] before:absolute before:top-full before:left-0 before:right-0 before:h-1"
							: "top-full mt-1 before:content-[''] before:absolute before:bottom-full before:left-0 before:right-0 before:h-1",
						isHovered
							? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
							: cn(
									"opacity-0 scale-95 pointer-events-none",
									placement === "top" ? "translate-y-1" : "-translate-y-1",
								),
					)}
					onMouseEnter={handleMouseEnter}
					onMouseLeave={handleMouseLeave}
				>
					{LANGUAGES.map((lang) => {
						const isSelected = lang.code === i18n.language;
						return (
							<button
								key={lang.code}
								type="button"
								onClick={() => handleSelect(lang.code)}
								className={cn(
									"w-full px-3 py-2 text-left text-sm transition-all duration-200",
									"flex items-center gap-2 rounded-md",
									isSelected
										? "bg-brand text-brand-foreground font-medium shadow-sm"
										: "text-foreground hover:bg-accent hover:text-accent-foreground",
								)}
							>
								<span
									className={cn(
										"transition-colors duration-200",
										isSelected ? "text-brand-foreground" : "text-foreground",
									)}
								>
									{lang.name}
								</span>
							</button>
						);
					})}
				</div>
			</div>
		);
	}

	return (
		<div
			className={cn(
				"flex items-center gap-1 p-1 bg-secondary border border-default rounded-lg shadow-sm",
				className,
			)}
		>
			{LANGUAGES.map((lang) => (
				<Button
					key={lang.code}
					variant={i18n.language === lang.code ? "default" : "ghost"}
					size="sm"
					onClick={() => i18n.changeLanguage(lang.code)}
					className={cn(
						"h-8 px-3 transition-all duration-200",
						i18n.language === lang.code && "shadow-sm",
					)}
				>
					{lang.name}
				</Button>
			))}
		</div>
	);
}
