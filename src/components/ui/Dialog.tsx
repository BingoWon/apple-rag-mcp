import * as DialogPrimitive from "@radix-ui/react-dialog";
import { IconX } from "@tabler/icons-react";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
	className,
	children,
	...props
}: ComponentProps<typeof DialogPrimitive.Content>) {
	const { t } = useTranslation();
	return (
		<DialogPrimitive.Portal>
			<DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
			<DialogPrimitive.Content
				className={cn(
					"fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-default bg-card p-6 text-foreground shadow-xl focus:outline-none",
					className,
				)}
				{...props}
			>
				{children}
				<DialogPrimitive.Close
					aria-label={t("common.close")}
					className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-brand"
				>
					<IconX className="h-4 w-4" />
				</DialogPrimitive.Close>
			</DialogPrimitive.Content>
		</DialogPrimitive.Portal>
	);
}
export function DialogHeader({ className, ...props }: ComponentProps<"div">) {
	return <div className={cn("mb-5 space-y-2 pr-8", className)} {...props} />;
}
export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
	return (
		<DialogPrimitive.Title
			className={cn("text-lg font-semibold tracking-tight", className)}
			{...props}
		/>
	);
}
export function DialogDescription({
	className,
	...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
	return (
		<DialogPrimitive.Description
			className={cn("text-sm text-muted-foreground", className)}
			{...props}
		/>
	);
}
export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
	return <div className={cn("mt-6 flex flex-wrap justify-end gap-2", className)} {...props} />;
}
