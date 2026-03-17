import { IconAlertTriangle } from "@tabler/icons-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
	fallbackSrc?: string;
	showPlaceholder?: boolean;
	placeholderClassName?: string;
}

export function OptimizedImage({
	src,
	alt,
	fallbackSrc,
	showPlaceholder = true,
	placeholderClassName,
	className,
	...props
}: OptimizedImageProps) {
	const [isLoading, setIsLoading] = useState(true);
	const [hasError, setHasError] = useState(false);
	const [currentSrc, setCurrentSrc] = useState(src);

	const handleLoad = () => {
		setIsLoading(false);
		setHasError(false);
	};

	const handleError = () => {
		setIsLoading(false);
		setHasError(true);

		if (fallbackSrc && currentSrc !== fallbackSrc) {
			setCurrentSrc(fallbackSrc);
			setIsLoading(true);
			setHasError(false);
		}
	};

	return (
		<div className={cn("relative overflow-hidden", className)}>
			{/* Error state */}
			{hasError && !fallbackSrc && (
				<div
					className={cn(
						"absolute inset-0 bg-gray-100 flex items-center justify-center",
						placeholderClassName,
					)}
				>
					<div className="text-center">
						<IconAlertTriangle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
						<p className="text-xs text-gray-500">Failed to load image</p>
					</div>
				</div>
			)}

			{/* Actual image */}
			<img
				src={currentSrc as string}
				alt={alt}
				onLoad={handleLoad}
				onError={handleError}
				className={cn("transition-opacity duration-300", isLoading ? "opacity-0" : "opacity-100")}
				{...props}
			/>
		</div>
	);
}

// Avatar component with fallback
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
					"inline-flex items-center justify-center rounded-full bg-gray-500 text-white font-medium",
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
