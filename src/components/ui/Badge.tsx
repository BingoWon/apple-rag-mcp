import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
	"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-all",
	{
		variants: {
			variant: {
				default: "bg-brand text-brand-foreground font-semibold",
				secondary: "bg-surface-subtle text-muted",
				destructive: "bg-destructive text-destructive-foreground font-semibold",
				success: "bg-success text-brand-foreground font-semibold",
				warning: "bg-warning text-brand-foreground font-semibold",
				outline: "border border-border text-muted",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

export interface BadgeProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
	return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
