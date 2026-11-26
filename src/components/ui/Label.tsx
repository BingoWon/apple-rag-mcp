import { type ComponentPropsWithoutRef, forwardRef } from "react";
import { cn } from "@/lib/utils";

const Label = forwardRef<HTMLLabelElement, ComponentPropsWithoutRef<"label">>(
	({ className, onMouseDown, htmlFor, ...props }, ref) => (
		// biome-ignore lint/a11y/noLabelWithoutControl: Reusable label primitive receives htmlFor or wraps inputs at call sites.
		<label
			ref={ref}
			htmlFor={htmlFor}
			onMouseDown={(event) => {
				onMouseDown?.(event);
				if (!event.defaultPrevented && event.detail > 1) {
					event.preventDefault();
				}
			}}
			className={cn(
				"text-sm font-medium text-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
				className,
			)}
			{...props}
		/>
	),
);
Label.displayName = "Label";

export { Label };
