import * as React from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface DialogContextType {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextType | null>(null);

function useDialog() {
	const context = React.useContext(DialogContext);
	if (!context) {
		throw new Error("Dialog components must be used within a Dialog");
	}
	return context;
}

interface DialogProps {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	children: React.ReactNode;
}

export function Dialog({ open = false, onOpenChange, children }: DialogProps) {
	const [internalOpen, setInternalOpen] = React.useState(open);

	const isControlled = onOpenChange !== undefined;
	const isOpen = isControlled ? open : internalOpen;

	const handleOpenChange = React.useCallback(
		(newOpen: boolean) => {
			if (isControlled) {
				onOpenChange?.(newOpen);
			} else {
				setInternalOpen(newOpen);
			}
		},
		[isControlled, onOpenChange],
	);

	React.useEffect(() => {
		if (!isControlled) {
			setInternalOpen(open);
		}
	}, [open, isControlled]);

	return (
		<DialogContext.Provider value={{ open: isOpen, onOpenChange: handleOpenChange }}>
			{children}
		</DialogContext.Provider>
	);
}

interface DialogTriggerProps {
	asChild?: boolean;
	children: React.ReactNode;
}

export function DialogTrigger({ asChild, children }: DialogTriggerProps) {
	const { onOpenChange } = useDialog();

	if (asChild && React.isValidElement(children)) {
		return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
			onClick: (e: React.MouseEvent) => {
				const originalOnClick = (children as React.ReactElement<Record<string, unknown>>).props
					.onClick as ((e: React.MouseEvent) => void) | undefined;
				originalOnClick?.(e);
				onOpenChange(true);
			},
		});
	}

	return <Button onClick={() => onOpenChange(true)}>{children}</Button>;
}

interface DialogContentProps {
	className?: string;
	children: React.ReactNode;
}

export function DialogContent({ className, children }: DialogContentProps) {
	const { open, onOpenChange } = useDialog();
	const [mounted, setMounted] = React.useState(false);

	React.useEffect(() => {
		setMounted(true);
	}, []);

	React.useEffect(() => {
		if (open) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "unset";
		}

		return () => {
			document.body.style.overflow = "unset";
		};
	}, [open]);

	if (!mounted || !open) return null;

	return createPortal(
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			{/* Backdrop */}
			{/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop overlay to close dialog on click */}
			<div
				className="fixed inset-0 bg-background/80 backdrop-blur-sm"
				onClick={() => onOpenChange(false)}
			/>

			{/* Content */}
			{/* biome-ignore lint/a11y/noStaticElementInteractions: dialog content wrapper uses onClick to prevent backdrop close propagation */}
			<div
				className={cn(
					"relative bg-card rounded-lg shadow-lg border border-border p-6 w-full max-w-md mx-4",
					className,
				)}
				onClick={(e) => e.stopPropagation()}
			>
				{children}
			</div>
		</div>,
		document.body,
	);
}

interface DialogHeaderProps {
	className?: string;
	children: React.ReactNode;
}

export function DialogHeader({ className, children }: DialogHeaderProps) {
	return (
		<div className={cn("flex flex-col space-y-1.5 text-center sm:text-left mb-4", className)}>
			{children}
		</div>
	);
}

interface DialogTitleProps {
	className?: string;
	children: React.ReactNode;
}

export function DialogTitle({ className, children }: DialogTitleProps) {
	return (
		<h3 className={cn("text-lg font-semibold leading-none tracking-tight", className)}>
			{children}
		</h3>
	);
}

interface DialogDescriptionProps {
	className?: string;
	children: React.ReactNode;
}

export function DialogDescription({ className, children }: DialogDescriptionProps) {
	return <p className={cn("text-sm text-gray-600 dark:text-gray-400", className)}>{children}</p>;
}

interface DialogFooterProps {
	className?: string;
	children: React.ReactNode;
}

export function DialogFooter({ className, children }: DialogFooterProps) {
	return (
		<div
			className={cn(
				"flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4",
				className,
			)}
		>
			{children}
		</div>
	);
}
