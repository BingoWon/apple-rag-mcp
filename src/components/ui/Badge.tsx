import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
	"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-all",
	{
		variants: {
			variant: {
				default: "bg-brand text-inverse font-semibold",
				secondary: "bg-tertiary text-muted",
				destructive: "bg-error text-inverse font-semibold",
				success: "bg-success text-inverse font-semibold",
				warning: "bg-warning text-inverse font-semibold",
				outline: "border border-default text-muted",
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
