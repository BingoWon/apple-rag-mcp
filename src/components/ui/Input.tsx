import type { InputHTMLAttributes } from "react";
import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
	error?: string;
	label?: string;
	helperText?: string;
}
const Input = forwardRef<HTMLInputElement, InputProps>(
	({ className, type, error, label, helperText, id, ...props }, ref) => {
		const generated = useId(),
			inputId = id ?? generated,
			hintId = `${inputId}-hint`;
		return (
			<div className="space-y-1.5">
				{label && (
					<label htmlFor={inputId} className="block text-sm font-medium text-foreground">
						{label}
					</label>
				)}
				<input
					{...props}
					id={inputId}
					type={type}
					ref={ref}
					aria-invalid={error ? true : props["aria-invalid"]}
					aria-describedby={
						[props["aria-describedby"], error || helperText ? hintId : undefined]
							.filter(Boolean)
							.join(" ") || undefined
					}
					className={cn(
						"flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-none transition-colors placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50",
						error && "border-error",
						className,
					)}
				/>
				{(error || helperText) && (
					<p
						id={hintId}
						role={error ? "alert" : undefined}
						className={cn(
							"text-xs leading-relaxed",
							error ? "text-error" : "text-muted-foreground",
						)}
					>
						{error || helperText}
					</p>
				)}
			</div>
		);
	},
);
Input.displayName = "Input";

export { Input };
