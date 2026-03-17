import { AnimatePresence, motion } from "motion/react";
import React, {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { useOutsideClick } from "@/hooks/useOutsideClick";
import { cn } from "@/lib/utils";

interface ModalContextType {
	open: boolean;
	setOpen: (open: boolean) => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider = ({ children }: { children: ReactNode }) => {
	const [open, setOpen] = useState(false);

	return <ModalContext.Provider value={{ open, setOpen }}>{children}</ModalContext.Provider>;
};

export const useModal = () => {
	const context = useContext(ModalContext);
	if (!context) {
		throw new Error("useModal must be used within a ModalProvider");
	}
	return context;
};

export function Modal({ children }: { children: ReactNode }) {
	return <ModalProvider>{children}</ModalProvider>;
}

export const ModalTrigger = ({
	children,
	className,
	onClick,
	disabled,
	...props
}: {
	children: ReactNode;
	className?: string;
	onClick?: () => void;
	disabled?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) => {
	const { setOpen } = useModal();

	const handleClick = () => {
		if (disabled) return;
		onClick?.();
		setOpen(true);
	};

	// Auto-detect: if children is a React element, clone it; otherwise use button
	if (React.isValidElement(children)) {
		return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
			onClick: handleClick,
			disabled,
		});
	}

	return (
		<button className={className} onClick={handleClick} disabled={disabled} {...props}>
			{children}
		</button>
	);
};

export const ModalBody = ({ children, className }: { children: ReactNode; className?: string }) => {
	const { open, setOpen } = useModal();
	const modalRef = useRef<HTMLDivElement>(null);

	// Memoize the close handler to prevent unnecessary re-renders
	const handleClose = useCallback(() => {
		setOpen(false);
	}, [setOpen]);

	// Handle body scroll lock
	useEffect(() => {
		if (open) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "auto";
		}

		// Cleanup on unmount
		return () => {
			document.body.style.overflow = "auto";
		};
	}, [open]);

	// Use the modern useOutsideClick hook with ESC key support
	useOutsideClick(modalRef, handleClose, {
		enabled: open,
		escapeKey: true,
		mouseEvents: true,
		touchEvents: true,
	});

	return (
		<AnimatePresence>
			{open && (
				<motion.div
					initial={{
						opacity: 0,
						backdropFilter: "blur(0px)",
					}}
					animate={{
						opacity: 1,
						backdropFilter: "blur(8px)",
					}}
					exit={{
						opacity: 0,
						backdropFilter: "blur(0px)",
					}}
					className="fixed [perspective:800px] [transform-style:preserve-3d] inset-0 h-full w-full flex items-center justify-center z-[9999]"
				>
					<Overlay />

					<motion.div
						ref={modalRef}
						className={cn(
							"max-h-[90%] w-full max-w-2xl bg-card/95 backdrop-blur-xl border border-border md:rounded-3xl relative z-[9999] flex flex-col overflow-hidden shadow-[var(--shadow-complex)] ring-1 ring-border/20",
							className,
						)}
						initial={{
							opacity: 0,
							scale: 0.5,
							rotateX: 40,
							y: 40,
						}}
						animate={{
							opacity: 1,
							scale: 1,
							rotateX: 0,
							y: 0,
						}}
						exit={{
							opacity: 0,
							scale: 0.8,
							rotateX: 10,
						}}
						transition={{
							type: "spring",
							stiffness: 260,
							damping: 15,
						}}
					>
						<CloseIcon />
						{children}
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
};

export const ModalContent = ({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) => {
	return (
		<div className={cn("flex flex-col flex-1 p-8 md:p-10 text-foreground", className)}>
			{children}
		</div>
	);
};

export const ModalFooter = ({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) => {
	return (
		<div className={cn("flex justify-end p-4 bg-accent border-t border-border", className)}>
			{children}
		</div>
	);
};

const Overlay = ({ className }: { className?: string }) => {
	return (
		<motion.div
			initial={{
				opacity: 0,
				backdropFilter: "blur(0px)",
			}}
			animate={{
				opacity: 1,
				backdropFilter: "blur(16px)",
			}}
			exit={{
				opacity: 0,
				backdropFilter: "blur(0px)",
			}}
			className={cn(
				"fixed inset-0 h-full w-full bg-background/80 backdrop-blur-sm z-[9999]",
				className,
			)}
		/>
	);
};

const CloseIcon = () => {
	const { setOpen } = useModal();

	// Memoize the click handler for better performance
	const handleClick = useCallback(() => {
		setOpen(false);
	}, [setOpen]);

	return (
		<button
			type="button"
			onClick={handleClick}
			className="absolute top-6 right-6 group p-2.5 rounded-full bg-card/90 backdrop-blur-md hover:bg-card transition-all duration-300 shadow-[var(--shadow-button)] hover:shadow-[var(--shadow-complex)] ring-1 ring-border hover:ring-border/60 hover:scale-105"
			aria-label="Close modal"
		>
			{/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative icon, button has aria-label */}
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				className="text-muted-foreground h-5 w-5 group-hover:scale-110 group-hover:rotate-90 transition-all duration-300 group-hover:text-foreground"
			>
				<path stroke="none" d="M0 0h24v24H0z" fill="none" />
				<path d="M18 6l-12 12" />
				<path d="M6 6l12 12" />
			</svg>
		</button>
	);
};
