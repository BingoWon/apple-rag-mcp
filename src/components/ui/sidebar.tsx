import { IconMenu2, IconX } from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import React, { createContext, useCallback, useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useInRouterContext } from "react-router-dom";
import { Brand } from "@/components/layout/Brand";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/utils";

interface Links {
	label: string;
	href: string;
	icon: React.JSX.Element | React.ReactNode;
	onClick?: () => void;
	badge?: string;
}

interface SidebarContextProps {
	open: boolean;
	setOpen: React.Dispatch<React.SetStateAction<boolean>>;
	animate: boolean;
	pinned: boolean;
	togglePin: () => void;
	closeMobile?: () => void;
}

const STORAGE_KEY = "sidebar-pinned";

export const SIDEBAR_CONTROL_CLASS_NAME =
	"size-9 rounded-md border-border/60 bg-transparent text-foreground/90 shadow-none backdrop-blur-none transition-all duration-200 hover:border-border hover:bg-surface-subtle hover:text-foreground hover:shadow-none [&_svg]:size-4.5";

const SidebarContext = createContext<SidebarContextProps | undefined>(undefined);
const MobileCloseContext = createContext<(() => void) | undefined>(undefined);

export const useSidebar = () => {
	const context = useContext(SidebarContext);
	if (!context) {
		throw new Error("useSidebar must be used within a SidebarProvider");
	}
	return context;
};

export const SidebarProvider = React.memo(
	({
		children,
		open: openProp,
		setOpen: setOpenProp,
		animate = true,
	}: {
		children: React.ReactNode;
		open?: boolean;
		setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
		animate?: boolean;
	}) => {
		const [openState, setOpenState] = useState(false);
		const [pinned, setPinned] = useState(() => {
			try {
				return localStorage.getItem(STORAGE_KEY) !== "false";
			} catch {
				return true;
			}
		});

		const open = openProp !== undefined ? openProp : openState;
		const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

		const togglePin = useCallback(() => {
			const next = !pinned;
			setPinned(next);
			try {
				localStorage.setItem(STORAGE_KEY, String(next));
			} catch {}
			setOpen(next);
		}, [pinned, setOpen]);

		const contextValue = React.useMemo(
			() => ({ open: pinned || open, setOpen, animate, pinned, togglePin }),
			[open, setOpen, animate, pinned, togglePin],
		);

		return <SidebarContext.Provider value={contextValue}>{children}</SidebarContext.Provider>;
	},
);

SidebarProvider.displayName = "SidebarProvider";

export const Sidebar = ({
	children,
	open,
	setOpen,
	animate,
}: {
	children: React.ReactNode;
	open?: boolean;
	setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
	animate?: boolean;
}) => {
	return (
		<SidebarProvider open={open} setOpen={setOpen} animate={animate}>
			{children}
		</SidebarProvider>
	);
};

export const SidebarBody = (props: React.ComponentProps<typeof motion.div>) => {
	return (
		<>
			<DesktopSidebar {...props} />
			<MobileSidebar {...(props as React.ComponentProps<"div">)} />
		</>
	);
};

export const DesktopSidebar = ({
	className,
	children,
	...props
}: React.ComponentProps<typeof motion.div>) => {
	const { open, setOpen, animate } = useSidebar();
	return (
		<motion.div
			className={cn(
				"h-full py-4 hidden md:flex md:flex-col bg-surface w-[300px] shrink-0",
				className,
			)}
			animate={{
				width: animate ? (open ? "300px" : "60px") : "300px",
				paddingLeft: animate ? (open ? "16px" : "8px") : "16px",
				paddingRight: animate ? (open ? "16px" : "8px") : "16px",
			}}
			onMouseEnter={() => setOpen(true)}
			onMouseLeave={() => setOpen(false)}
			{...props}
		>
			{children}
		</motion.div>
	);
};

export const MobileSidebar = ({ className, children, ...props }: React.ComponentProps<"div">) => {
	const { t } = useTranslation();
	const { setOpen } = useSidebar();
	const inRouter = useInRouterContext();
	const [mobileOpen, setMobileOpen] = useState(false);
	const setMenuOpen = useCallback(
		(next: boolean) => {
			setMobileOpen(next);
			setOpen(next);
		},
		[setOpen],
	);
	const closeMobile = useCallback(() => setMenuOpen(false), [setMenuOpen]);

	return (
		<div
			className={cn(
				"flex h-14 w-full shrink-0 flex-row items-center justify-between border-b border-border bg-surface px-4 md:hidden",
			)}
			{...props}
		>
			{inRouter ? (
				<Link to="/" className="flex items-center text-foreground">
					<Brand />
				</Link>
			) : (
				<a href="/" className="flex items-center text-foreground">
					<Brand />
				</a>
			)}
			<div className="flex items-center gap-2 z-20">
				<LanguageSwitcher className={SIDEBAR_CONTROL_CLASS_NAME} />
				<ThemeToggle variant="icon" className={SIDEBAR_CONTROL_CLASS_NAME} />
				<button
					type="button"
					aria-label={mobileOpen ? t("common.close") : t("nav.menu")}
					aria-expanded={mobileOpen}
					className="inline-flex size-9 items-center justify-center rounded-md text-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
					onClick={() => setMenuOpen(!mobileOpen)}
				>
					<IconMenu2 aria-hidden="true" className="h-5 w-5" />
				</button>
			</div>
			<AnimatePresence>
				{mobileOpen && (
					<>
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.3 }}
							className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[90]"
							onClick={closeMobile}
						/>

						<motion.div
							role="dialog"
							aria-modal="true"
							aria-label={t("nav.menu")}
							initial={{ x: "-100%", opacity: 0 }}
							animate={{ x: 0, opacity: 1 }}
							exit={{ x: "-100%", opacity: 0 }}
							transition={{
								duration: 0.3,
								ease: "easeInOut",
							}}
							className={cn(
								"fixed h-full w-[80%] max-w-xs inset-y-0 left-0 bg-background/95 backdrop-blur-md border-r border-border p-6 z-[100] flex flex-col justify-between shadow-2xl",
								className,
							)}
						>
							<button
								type="button"
								aria-label={t("common.close")}
								className="absolute right-5 top-5 z-50 rounded-md p-1.5 text-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
								onClick={closeMobile}
							>
								<IconX aria-hidden="true" className="h-5 w-5" />
							</button>
							<MobileCloseContext.Provider value={closeMobile}>
								{children}
							</MobileCloseContext.Provider>
						</motion.div>
					</>
				)}
			</AnimatePresence>
		</div>
	);
};

export const SidebarLink = ({
	link,
	className,
	isActive = false,
	...props
}: {
	link: Links;
	className?: string;
	isActive?: boolean;
}) => {
	const { open, animate } = useSidebar();
	const closeMobile = useContext(MobileCloseContext);
	const inRouter = useInRouterContext();

	const handleClick = (e: React.MouseEvent) => {
		if (link.onClick) {
			e.preventDefault();
			closeMobile?.();
			link.onClick();
			return;
		}
		closeMobile?.();
	};

	const linkClassName = cn(
		"flex items-center group/sidebar py-2 rounded-lg transition-colors duration-200 relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
		isActive
			? "bg-brand text-white font-semibold"
			: "font-medium text-foreground/90 hover:text-foreground hover:bg-surface-subtle",
		className,
	);
	const linkStyle: React.CSSProperties = {
		justifyContent: open ? "flex-start" : "center",
		gap: open ? "8px" : "0",
		paddingLeft: open ? "8px" : "4px",
		paddingRight: open ? "8px" : "4px",
	};

	const content = (
		<>
			<div className="flex-shrink-0 relative text-inherit">
				{link.icon}

				{link.badge && !open && (
					<span className="absolute -top-1 -right-1 w-2 h-2 bg-destructive rounded-full" />
				)}
			</div>

			<motion.span
				animate={{
					width: animate ? (open ? "auto" : 0) : "auto",
					opacity: animate ? (open ? 1 : 0) : 1,
				}}
				transition={{
					duration: 0.2,
					ease: "easeInOut",
				}}
				className="text-sm whitespace-nowrap overflow-hidden inline-block text-inherit"
				style={{
					display: open ? "inline-block" : "none",
				}}
			>
				{link.label}
			</motion.span>

			{link.badge && open && (
				<motion.span
					animate={{
						scale: animate ? 1 : 1,
						opacity: animate ? 1 : 1,
					}}
					transition={{
						duration: 0.2,
						ease: "easeInOut",
					}}
					className="ml-auto flex items-center justify-center w-5 h-5 text-xs font-bold text-destructive-foreground bg-destructive rounded-full"
				>
					{link.badge}
				</motion.span>
			)}
		</>
	);

	const useSpaLink = inRouter && !link.onClick && link.href.startsWith("/");
	if (useSpaLink) {
		return (
			<Link
				to={link.href}
				aria-label={link.label}
				aria-current={isActive ? "page" : undefined}
				className={linkClassName}
				style={linkStyle}
				onClick={handleClick}
				{...props}
			>
				{content}
			</Link>
		);
	}

	return (
		<a
			href={link.href}
			aria-label={link.label}
			aria-current={isActive ? "page" : undefined}
			className={linkClassName}
			style={linkStyle}
			onClick={handleClick}
			{...props}
		>
			{content}
		</a>
	);
};
