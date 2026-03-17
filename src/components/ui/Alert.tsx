import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const alertVariants = cva(
	"relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-light",
	{
		variants: {
			variant: {
				default: "bg-secondary text-light border-default",
				destructive: "border-error/50 text-error bg-error/10 [&>svg]:text-error",
				success: "border-success/50 text-success bg-success/10 [&>svg]:text-success",
				warning: "border-warning/50 text-warning bg-warning/10 [&>svg]:text-warning",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

const Alert = forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
	<div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
));
Alert.displayName = "Alert";

const AlertTitle = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
	({ className, ...props }, ref) => (
		<h5
			ref={ref}
			className={cn("mb-1 font-medium leading-none tracking-tight", className)}
			{...props}
		/>
	),
);
AlertTitle.displayName = "AlertTitle";

const AlertDescription = forwardRef<
	HTMLParagraphElement,
	React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
	<div ref={ref} className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertDescription, AlertTitle };
