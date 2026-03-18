import { IconMenu2, IconX } from "@tabler/icons-react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { activateFabContact } from "@/components/ui/FabButton";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";

// 创建 Context 来传递 visible 状态
const NavbarContext = createContext<{ visible: boolean }>({ visible: false });

// Modern animation configuration
const ANIMATION_CONFIG = {
	spring: {
		type: "spring" as const,
		stiffness: 200,
		damping: 50,
	},
	scrollThreshold: 100,
	navWidthCollapsed: "50%",
	mobileWidthCollapsed: "75%",
} as const;

// Navigation item type
interface NavItem {
	name: string;
	link: string;
}

// Component interfaces with modern patterns
interface NavbarProps {
	children: React.ReactNode;
	className?: string;
	scrollThreshold?: number;
}

interface NavBodyProps {
	children: React.ReactNode;
	className?: string;
	visible?: boolean;
}

interface NavItemsProps {
	items: NavItem[];
	className?: string;
	onItemClick?: () => void;
}

interface MobileNavProps {
	children: React.ReactNode;
	className?: string;
	visible?: boolean;
}

interface MobileNavMenuProps {
	children: React.ReactNode;
	className?: string;
	isOpen: boolean;
}

interface MobileNavHeaderProps {
	children: React.ReactNode;
	className?: string;
}

interface UserMenuProps {
	user: { name?: string; email?: string } | null;
	visible?: boolean;
	onLogout: () => void;
}

export const Navbar = ({
	children,
	className,
	scrollThreshold = ANIMATION_CONFIG.scrollThreshold,
}: NavbarProps) => {
	const ref = useRef<HTMLDivElement>(null);
	const { scrollY } = useScroll({
		target: ref,
		offset: ["start start", "end start"],
	});
	const [visible, setVisible] = useState(false);

	useMotionValueEvent(scrollY, "change", (latest) => {
		setVisible(latest > scrollThreshold);
	});

	return (
		<motion.div ref={ref} className={cn("sticky inset-x-0 top-1 z-40 w-full", className)}>
			{React.Children.map(children, (child) =>
				React.isValidElement(child)
					? React.cloneElement(child as React.ReactElement<{ visible?: boolean }>, { visible })
					: child,
			)}
		</motion.div>
	);
};

export const NavBody = ({ children, className, visible }: NavBodyProps) => {
	return (
		<motion.div
			animate={{
				backdropFilter: visible ? "blur(10px)" : "none",
				boxShadow: visible
					? "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"
					: "none",
				borderRadius: visible ? "12px" : "0px",
				width: visible ? "40%" : "100%",
				y: visible ? 20 : 0,
			}}
			transition={{
				type: "spring",
				stiffness: 200,
				damping: 50,
			}}
			style={{
				minWidth: "800px",
			}}
			className={cn(
				"relative z-[60] mx-auto hidden w-full max-w-7xl flex-row items-center justify-between self-start bg-transparent px-4 py-3 lg:flex",
				visible && "bg-background/60 backdrop-blur-md border border-border",
				className,
			)}
		>
			<NavbarContext.Provider value={{ visible: visible || false }}>
				{children}
			</NavbarContext.Provider>
		</motion.div>
	);
};

export const NavItems = ({ items, className, onItemClick }: NavItemsProps) => {
	const [hovered, setHovered] = useState<number | null>(null);

	return (
		<motion.div
			onMouseLeave={() => setHovered(null)}
			className={cn(
				"absolute inset-0 hidden flex-1 flex-row items-center justify-center space-x-2 text-md font-semibold text-muted transition duration-200 hover:text-light lg:flex lg:space-x-2",
				className,
			)}
		>
			{items.map((item, idx) => (
				<a
					onMouseEnter={() => setHovered(idx)}
					onClick={(e) => {
						if (item.link === "#contact") {
							e.preventDefault();
							activateFabContact();
						} else {
							onItemClick?.();
						}
					}}
					className="relative px-4 py-2 text-muted"
					key={`link-${idx}`}
					href={item.link === "#contact" ? "#" : item.link}
					data-nav-action={item.link === "#contact" ? "fab-contact" : undefined}
				>
					{hovered === idx && (
						<motion.div
							layoutId="hovered"
							className="absolute inset-0 h-full w-full rounded-lg bg-secondary"
						/>
					)}
					<span className="relative z-20">{item.name}</span>
				</a>
			))}
		</motion.div>
	);
};

export const MobileNav = ({ children, className, visible }: MobileNavProps) => {
	return (
		<motion.div
			animate={{
				backdropFilter: visible ? "blur(10px)" : "none",
				boxShadow: visible
					? "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"
					: "none",
				borderRadius: visible ? "12px" : "0px",
				width: visible ? ANIMATION_CONFIG.mobileWidthCollapsed : "100%",
				paddingLeft: visible ? "16px" : "16px",
				paddingRight: visible ? "16px" : "16px",
				y: visible ? 20 : 0,
			}}
			transition={{
				type: "spring",
				stiffness: 200,
				damping: 50,
			}}
			className={cn(
				"relative z-50 mx-auto flex w-full max-w-[calc(100vw-2rem)] flex-col items-center justify-between bg-transparent py-3 lg:hidden",
				visible && "bg-background/60 backdrop-blur-md border border-border",
				className,
			)}
		>
			{children}
		</motion.div>
	);
};

export const MobileNavHeader = ({ children, className }: MobileNavHeaderProps) => {
	return (
		<div className={cn("flex w-full flex-row items-center justify-between", className)}>
			{children}
		</div>
	);
};

export const MobileNavMenu = ({ children, className, isOpen }: MobileNavMenuProps) => {
	return (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					className={cn(
						"absolute inset-x-0 top-16 z-50 flex w-full flex-col items-center justify-start gap-4 rounded-xl bg-background/90 backdrop-blur-md border border-border shadow-complex px-4 py-8",
						className,
					)}
				>
					{children}
				</motion.div>
			)}
		</AnimatePresence>
	);
};

export const MobileNavToggle = ({ isOpen, onClick }: { isOpen: boolean; onClick: () => void }) => {
	return isOpen ? (
		<IconX className="text-light" onClick={onClick} />
	) : (
		<IconMenu2 className="text-light" onClick={onClick} />
	);
};

export const UserMenu = ({ user, onLogout }: Omit<UserMenuProps, "visible">) => {
	const { visible } = useContext(NavbarContext);
	const { t } = useTranslation();
	return (
		<>
			{/* 用户名 - 始终显示 */}
			<div className="relative group">
				<span className="text-sm font-semibold text-muted cursor-pointer">
					{user?.name || user?.email}
				</span>

				{/* 悬浮菜单 - 只在收缩状态下显示 */}
				{visible && (
					<div className="absolute right-0 top-full mt-2 w-48 bg-primary border border-default rounded-lg shadow-complex opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
						<div className="p-2 space-y-1">
							<a
								href="/overview/"
								className="block px-3 py-2 text-sm text-muted hover:text-light hover:bg-secondary rounded-md"
							>
								{t("common.dashboard")}
							</a>
							<button
								type="button"
								onClick={onLogout}
								className="block w-full text-left px-3 py-2 text-sm text-muted hover:text-light hover:bg-secondary rounded-md"
							>
								{t("common.logout")}
							</button>
						</div>
					</div>
				)}
			</div>

			{/* 按钮 - 只在初始状态下显示 */}
			{!visible && (
				<Button variant="gradient" asChild>
					<a href="/overview/">{t("common.dashboard")}</a>
				</Button>
			)}
		</>
	);
};

export function AppNavbar() {
	const { t } = useTranslation();
	const { user, isAuthenticated, logout } = useAuthStore();
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

	// Homepage logout handler - stays on current page, only changes navbar state
	const handleLogout = useCallback(async () => {
		try {
			logout();
			toast.success(t("nav.logout_success"));
			setIsMobileMenuOpen(false);
		} catch (error) {
			console.error("Logout error:", error);
			toast.error(t("nav.logout_error"));
		}
	}, [logout, t]);

	const handleMenuClose = () => setIsMobileMenuOpen(false);

	const navItems = [
		{ name: t("nav.features"), link: "#features" },
		{ name: t("nav.pricing"), link: "#pricing" },
		{ name: t("nav.contact"), link: "#contact" },
	];

	return (
		<Navbar>
			{/* Desktop Navigation */}
			<NavBody>
				<a
					href="/"
					className="relative z-20 mr-4 flex items-center text-sm font-medium text-light transition-fast hover:text-brand"
				>
					<img src="/logo-with-text.svg" alt="Apple RAG MCP" className="h-8 w-auto" />
				</a>
				<NavItems items={navItems} onItemClick={handleMenuClose} />
				<div className="flex items-center gap-3">
					<LanguageSwitcher />
					<ThemeToggle variant="icon" />
					{isAuthenticated ? (
						<UserMenu user={user} onLogout={handleLogout} />
					) : (
						<Button variant="primary" asChild>
							<a href="/login">{t("common.login")} / {t("common.sign_up")}</a>
						</Button>
					)}
				</div>
			</NavBody>

			{/* Mobile Navigation */}
			<MobileNav>
				<MobileNavHeader>
					<a
						href="/"
						className="relative z-20 mr-4 flex items-center text-sm font-medium text-light transition-fast hover:text-brand"
					>
						<img src="/logo-with-text.svg" alt="Apple RAG MCP" className="h-8 w-auto" />
					</a>
					<div className="flex items-center gap-3">
						<LanguageSwitcher />
						<ThemeToggle variant="icon" />
						<MobileNavToggle
							isOpen={isMobileMenuOpen}
							onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
						/>
					</div>
				</MobileNavHeader>

				<MobileNavMenu isOpen={isMobileMenuOpen}>
					{navItems.map((item, idx) => (
						<a
							key={`mobile-nav-${idx}`}
							href={item.link === "#contact" ? "#" : item.link}
							onClick={(e) => {
								if (item.link === "#contact") {
									e.preventDefault();
									activateFabContact();
								}
								handleMenuClose();
							}}
							className="text-muted hover:text-light transition-fast"
							data-nav-action={item.link === "#contact" ? "fab-contact" : undefined}
						>
							{item.name}
						</a>
					))}

					<div className="flex w-full flex-col items-center gap-4 pt-4 border-t border-default">
						<div className="w-full flex justify-center">
							<ThemeToggle variant="dropdown" className="w-full max-w-xs" />
						</div>
						{isAuthenticated ? (
							<>
								<div className="text-center">
									<p className="text-sm font-semibold text-light">{user?.name || user?.email}</p>
								</div>
								<Button variant="gradient" className="w-full" asChild>
									<a href="/overview/" onClick={handleMenuClose}>
										{t("common.dashboard")}
									</a>
								</Button>
							</>
						) : (
							<Button variant="gradient" className="w-full" asChild>
								<a href="/login" onClick={handleMenuClose}>
									{t("common.login")} / {t("common.sign_up")}
								</a>
							</Button>
						)}
					</div>
				</MobileNavMenu>
			</MobileNav>
		</Navbar>
	);
}
