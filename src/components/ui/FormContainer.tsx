// FormContainer component for consistent form styling

import type React from "react";
import { cn } from "@/lib/utils";

interface FormContainerProps {
	children: React.ReactNode;
	title: string;
	subtitle: string;
	className?: string;
}

const FormContainer = ({ children, title, subtitle, className }: FormContainerProps) => {
	return (
		<div
			className={cn(
				"shadow-input mx-auto w-full max-w-xl rounded-none bg-card border border-border p-6 md:rounded-2xl md:p-10",
				className,
			)}
		>
			<div className="text-center mb-8">
				<h2 className="text-2xl font-bold text-foreground mb-2">{title}</h2>
				<p className="text-muted-foreground text-base">{subtitle}</p>
			</div>
			{children}
		</div>
	);
};

export { FormContainer };
