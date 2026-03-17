import { IconMenu2, IconX } from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import React, { createContext, useCallback, useContext, useState } from "react";
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
}

const STORAGE_KEY = "sidebar-pinned";

const SidebarContext = createContext<SidebarContextProps | undefined>(undefined);

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
				return localStorage.getItem(STORAGE_KEY) === "true";
			} catch {
				return false;
			}
		});

		const open = openProp !== undefined ? openProp : openState;
		const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

		const togglePin = useCallback(() => {
			setPinned((prev) => {
				const next = !prev;
				try {
					localStorage.setItem(STORAGE_KEY, String(next));
				} catch {}
				if (next) setOpen(true);
				return next;
			});
		}, [setOpen]);

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
	const { open, setOpen, animate, pinned } = useSidebar();
	return (
		<motion.div
			className={cn(
				"h-full py-4 hidden md:flex md:flex-col bg-secondary w-[300px] shrink-0",
				className,
			)}
			animate={{
				width: animate ? (open ? "300px" : "60px") : "300px",
				paddingLeft: animate ? (open ? "16px" : "8px") : "16px",
				paddingRight: animate ? (open ? "16px" : "8px") : "16px",
			}}
			onMouseEnter={() => {
				if (!pinned) setOpen(true);
			}}
			onMouseLeave={() => {
				if (!pinned) setOpen(false);
			}}
			{...props}
		>
			{children}
		</motion.div>
	);
};

export const MobileSidebar = ({ className, children, ...props }: React.ComponentProps<"div">) => {
	const { open, setOpen } = useSidebar();
	return (
		<div
			className={cn(
				"h-10 px-4 py-4 flex flex-row md:hidden  items-center justify-end bg-secondary w-full",
			)}
			{...props}
		>
			{/* Right side controls */}
			<div className="flex items-center gap-2 z-20">
				<LanguageSwitcher />
				<ThemeToggle variant="icon" />
				<IconMenu2
					className="text-light cursor-pointer hover:text-muted transition-colors p-1"
					onClick={() => setOpen(!open)}
				/>
			</div>
			<AnimatePresence>
				{open && (
					<>
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.3 }}
							className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[90]"
							onClick={() => setOpen(false)}
						/>

						<motion.div
							initial={{ x: "-100%", opacity: 0 }}
							animate={{ x: 0, opacity: 1 }}
							exit={{ x: "-100%", opacity: 0 }}
							transition={{
								duration: 0.3,
								ease: "easeInOut",
							}}
							className={cn(
								"fixed h-full w-[80%] inset-y-0 left-0 bg-background/95 backdrop-blur-md border-r border-default p-6 z-[100] flex flex-col justify-between shadow-2xl",
								className,
							)}
						>
							<button
								type="button"
								className="absolute right-6 top-6 z-50 text-light cursor-pointer hover:text-muted transition-colors"
								onClick={() => setOpen(!open)}
							>
								<IconX />
							</button>
							{children}
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

	const handleClick = (e: React.MouseEvent) => {
		if (link.onClick) {
			e.preventDefault();
			link.onClick();
		}
	};

	return (
		<a
			href={link.href}
			className={cn(
				"flex items-center group/sidebar py-2 rounded-lg transition-all duration-200 relative",
				isActive ? "bg-brand text-white" : "text-muted hover:text-light hover:bg-tertiary",
				className,
			)}
			style={{
				justifyContent: open ? "flex-start" : "center",
				gap: open ? "8px" : "0",
				paddingLeft: open ? "8px" : "4px",
				paddingRight: open ? "8px" : "4px",
			}}
			onClick={handleClick}
			{...props}
		>
			<div
				className={cn(
					"transition-colors duration-200 flex-shrink-0 relative",
					isActive ? "text-white" : "text-muted group-hover/sidebar:text-light",
				)}
			>
				{link.icon}

				{link.badge && !open && (
					<span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
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
				className={cn(
					"text-sm whitespace-nowrap overflow-hidden inline-block",
					isActive ? "text-white font-medium" : "text-muted",
				)}
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
					className="ml-auto flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full"
				>
					{link.badge}
				</motion.span>
			)}
		</a>
	);
};
