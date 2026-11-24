import { Slot } from "@radix-ui/react-slot";
import { IconLoader2 } from "@tabler/icons-react";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 cursor-pointer relative",
	{
		variants: {
			variant: {
				default: "bg-tertiary text-light border border-default hover:bg-secondary",
				primary:
					"bg-action-surface text-action-surface-foreground border border-transparent hover:opacity-90",
				secondary: "bg-tertiary text-light hover:bg-secondary border border-default",
				ghost: "bg-transparent text-light hover:bg-secondary border border-transparent",
				gradient:
					"bg-gradient-to-b from-brand to-brand-tertiary text-inverse shadow-input hover:shadow-button hover:scale-[1.02] active:scale-[0.98]",
				link: "underline-offset-4 hover:underline text-brand hover:text-brand-secondary bg-transparent hover:bg-brand/10",
				outline: "border border-default bg-card text-light hover:bg-secondary",
				destructive: "bg-red-600 text-white border border-transparent hover:bg-red-700",
			},
			size: {
				default: "h-10 px-4 py-2",
				sm: "h-9 px-3 text-xs",
				lg: "h-11 px-8 text-base",
				icon: "h-8 w-8 border border-border",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean;
	loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
	(
		{
			className,
			variant,
			size,
			asChild = false,
			loading,
			children,
			disabled,
			type = "button",
			...props
		},
		ref,
	) => {
		const Comp = asChild ? Slot : "button";

		// When asChild is true and loading is true, we can't use loading state
		// because Slot expects a single React element child
		if (asChild && loading) {
			console.warn(
				"Button: loading state is not supported when asChild is true. The loading state will be ignored.",
			);
		}

		const shouldShowLoading = loading && !asChild;

		return (
			<Comp
				className={cn(buttonVariants({ variant, size, className }))}
				ref={ref}
				disabled={disabled || loading}
				aria-busy={shouldShowLoading || undefined}
				type={asChild ? undefined : type}
				{...props}
			>
				{shouldShowLoading ? (
					<>
						<IconLoader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
						{children}
					</>
				) : (
					children
				)}
			</Comp>
		);
	},
);
Button.displayName = "Button";

export { Button, buttonVariants };
