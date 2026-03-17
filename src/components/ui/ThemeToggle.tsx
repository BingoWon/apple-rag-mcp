import { IconDeviceDesktop, IconMoon, IconSun } from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
	className?: string;
	variant?: "icon" | "dropdown";
	placement?: "top" | "bottom";
}

export function ThemeToggle({
	className,
	variant = "icon",
	placement = "bottom",
}: ThemeToggleProps) {
	const { theme, setTheme, isTransitioning } = useTheme();
	const [isHovered, setIsHovered] = useState(false);
	const [isClicking, setIsClicking] = useState(false);
	const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	// 获取所有三种模式（用于下拉菜单）
	const getAllThemes = useCallback(() => {
		return ["light", "dark", "system"] as const;
	}, []);

	// 清理定时器
	useEffect(() => {
		return () => {
			if (hideTimeoutRef.current) {
				clearTimeout(hideTimeoutRef.current);
			}
		};
	}, []);

	// 延迟隐藏菜单，给用户移动鼠标的时间
	const handleMouseEnter = useCallback(() => {
		// 如果正在点击切换主题，不显示面板
		if (isClicking) return;

		if (hideTimeoutRef.current) {
			clearTimeout(hideTimeoutRef.current);
			hideTimeoutRef.current = null;
		}
		setIsHovered(true);
	}, [isClicking]);

	const handleMouseLeave = useCallback(() => {
		hideTimeoutRef.current = setTimeout(() => {
			setIsHovered(false);
		}, 150); // 150ms 延迟，给用户移动鼠标的时间
	}, []);

	const handleThemeSelect = useCallback(
		(selectedTheme: "light" | "dark" | "system") => {
			setTheme(selectedTheme);
			setIsHovered(false); // 选择后隐藏菜单
			if (hideTimeoutRef.current) {
				clearTimeout(hideTimeoutRef.current);
				hideTimeoutRef.current = null;
			}
		},
		[setTheme],
	);

	// 循环切换到下一个主题
	const handleCycleTheme = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();

			// 标记正在点击，防止悬停效果
			setIsClicking(true);

			// 确保面板不会因为点击而显示
			setIsHovered(false);
			if (hideTimeoutRef.current) {
				clearTimeout(hideTimeoutRef.current);
				hideTimeoutRef.current = null;
			}

			const allThemes = getAllThemes();
			const currentIndex = allThemes.indexOf(theme);
			const nextIndex = (currentIndex + 1) % allThemes.length;
			setTheme(allThemes[nextIndex]);

			// 短暂延迟后重置点击状态
			setTimeout(() => {
				setIsClicking(false);
			}, 200);
		},
		[theme, setTheme, getAllThemes],
	);

	// 获取主题图标和标签
	const getThemeIcon = (themeType: "light" | "dark" | "system") => {
		switch (themeType) {
			case "light":
				return <IconSun className="h-4 w-4" />;
			case "dark":
				return <IconMoon className="h-4 w-4" />;
			case "system":
				return <IconDeviceDesktop className="h-4 w-4" />;
		}
	};

	const getThemeLabel = (themeType: "light" | "dark" | "system") => {
		switch (themeType) {
			case "light":
				return "Light";
			case "dark":
				return "Dark";
			case "system":
				return "System";
		}
	};

	if (variant === "icon") {
		const allThemes = getAllThemes();

		return (
			<div
				ref={containerRef}
				className="relative flex items-center"
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
				onClick={(e) => e.stopPropagation()}
			>
				<Button
					size="icon"
					variant="ghost"
					className={cn(
						"relative transition-all duration-200",
						isTransitioning && "opacity-70 scale-95",
						className,
					)}
					onClick={handleCycleTheme}
					title={`Current theme: ${theme}. Click to cycle themes.`}
				>
					<IconSun
						className={cn(
							"h-4 w-4 absolute",
							theme === "light" ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-0 opacity-0",
						)}
					/>
					<IconMoon
						className={cn(
							"h-4 w-4 absolute",
							theme === "dark" ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0",
						)}
					/>
					<IconDeviceDesktop
						className={cn(
							"h-4 w-4 absolute",
							theme === "system"
								? "rotate-0 scale-100 opacity-100"
								: "rotate-180 scale-0 opacity-0",
						)}
					/>
					<span className="sr-only">Current theme: {theme}</span>
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
					{allThemes.map((themeOption) => {
						const isSelected = themeOption === theme;
						return (
							<button
								key={themeOption}
								onClick={() => handleThemeSelect(themeOption)}
								disabled={isTransitioning}
								className={cn(
									"w-full px-3 py-2 text-left text-sm transition-all duration-200",
									"flex items-center gap-2 rounded-md",
									"disabled:opacity-50 disabled:cursor-not-allowed",
									isSelected
										? "bg-brand text-brand-foreground font-medium shadow-sm"
										: "text-foreground hover:bg-accent hover:text-accent-foreground",
								)}
							>
								<span
									className={cn(
										"transition-colors duration-200",
										isSelected ? "text-brand-foreground" : "text-muted-foreground",
									)}
								>
									{getThemeIcon(themeOption)}
								</span>
								<span
									className={cn(
										"transition-colors duration-200",
										isSelected ? "text-brand-foreground" : "text-foreground",
									)}
								>
									{getThemeLabel(themeOption)}
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
				"flex items-center gap-1 p-1 bg-secondary border border-default rounded-lg transition-opacity duration-200 shadow-sm",
				isTransitioning && "opacity-70",
				className,
			)}
		>
			<Button
				variant={theme === "light" ? "default" : "ghost"}
				size="sm"
				onClick={() => setTheme("light")}
				disabled={isTransitioning}
				className={cn("h-8 px-3 transition-all duration-200", theme === "light" && "shadow-sm")}
			>
				<IconSun className="h-4 w-4 mr-1" />
				Light
			</Button>
			<Button
				variant={theme === "dark" ? "default" : "ghost"}
				size="sm"
				onClick={() => setTheme("dark")}
				disabled={isTransitioning}
				className={cn("h-8 px-3 transition-all duration-200", theme === "dark" && "shadow-sm")}
			>
				<IconMoon className="h-4 w-4 mr-1" />
				Dark
			</Button>
			<Button
				variant={theme === "system" ? "default" : "ghost"}
				size="sm"
				onClick={() => setTheme("system")}
				disabled={isTransitioning}
				className={cn("h-8 px-3 transition-all duration-200", theme === "system" && "shadow-sm")}
			>
				<IconDeviceDesktop className="h-4 w-4 mr-1" />
				System
			</Button>
		</div>
	);
}
