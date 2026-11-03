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
		<div className={cn("w-full", className)}>
			<div className="mb-7">
				<h1 className="auth-title">{title}</h1>
				<p className="auth-description">{subtitle}</p>
			</div>
			{children}
		</div>
	);
};

export { FormContainer };
