import { Slot } from "@radix-ui/react-slot";
import { IconLoader2 } from "@tabler/icons-react";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 cursor-pointer relative",
	{
		variants: {
			variant: {
				default: "bg-surface-subtle text-foreground border border-border hover:bg-surface",
				primary:
					"bg-brand text-brand-foreground font-semibold border border-transparent hover:opacity-90",
				secondary: "bg-surface-subtle text-foreground hover:bg-surface border border-border",
				ghost: "bg-transparent text-foreground hover:bg-surface border border-transparent",
				gradient:
					"bg-gradient-to-b from-brand to-brand-strong text-brand-foreground font-semibold shadow-input hover:shadow-button hover:scale-[1.02] active:scale-[0.98] transition-all",
				link: "underline-offset-4 hover:underline text-brand hover:text-brand-strong bg-transparent hover:bg-brand/10",
				outline: "border border-border bg-card text-foreground hover:bg-surface",
				destructive:
					"bg-destructive text-destructive-foreground font-semibold border border-transparent hover:bg-destructive/90",
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
