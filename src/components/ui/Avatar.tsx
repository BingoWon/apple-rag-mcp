import { useState } from "react";
import { cn } from "@/lib/utils";

interface AvatarProps {
	src?: string;
	name: string;
	size?: "sm" | "md" | "lg" | "xl";
	className?: string;
}

const avatarSizes = {
	sm: "h-8 w-8 text-xs",
	md: "h-10 w-10 text-sm",
	lg: "h-12 w-12 text-base",
	xl: "h-16 w-16 text-lg",
};

export function Avatar({ src, name, size = "md", className }: AvatarProps) {
	const [hasError, setHasError] = useState(false);

	const initials = name
		.split(" ")
		.map((n) => n[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);

	if (!src || hasError) {
		return (
			<div
				className={cn(
					"inline-flex items-center justify-center rounded-full bg-surface-subtle text-foreground border border-border font-medium",
					avatarSizes[size],
					className,
				)}
			>
				{initials}
			</div>
		);
	}

	return (
		<div className={cn("relative", avatarSizes[size], className)}>
			<img
				src={src}
				alt={name}
				className="absolute inset-0 w-full h-full rounded-full object-cover"
				onError={() => setHasError(true)}
			/>
		</div>
	);
}
