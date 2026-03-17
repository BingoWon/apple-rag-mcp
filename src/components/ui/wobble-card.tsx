import { motion } from "motion/react";
import type React from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export const WobbleCard = ({
	children,
	containerClassName,
	className,
	onClick,
}: {
	children: React.ReactNode;
	containerClassName?: string;
	className?: string;
	onClick?: () => void;
}) => {
	const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
	const [isHovering, setIsHovering] = useState(false);
	// Detect Safari (exclude Chrome/Android)
	const isSafari =
		typeof navigator !== "undefined" &&
		/safari/i.test(navigator.userAgent) &&
		!/chrome|crios|android/i.test(navigator.userAgent);

	const handleMouseMove = (event: React.MouseEvent<HTMLElement>) => {
		if (isSafari) return;
		const { clientX, clientY } = event;
		const rect = event.currentTarget.getBoundingClientRect();
		const x = (clientX - (rect.left + rect.width / 2)) / 20;
		const y = (clientY - (rect.top + rect.height / 2)) / 20;
		setMousePosition({ x, y });
	};
	return (
		<motion.section
			onMouseMove={handleMouseMove}
			onMouseEnter={() => setIsHovering(true)}
			onMouseLeave={() => {
				setIsHovering(false);
				setMousePosition({ x: 0, y: 0 });
			}}
			onClick={onClick}
			style={
				isSafari
					? {
							transform: "translate3d(0, 0, 0) scale3d(1, 1, 1)",
							transition: "transform 0.1s ease-out",
						}
					: {
							transform: isHovering
								? `translate3d(${mousePosition.x}px, ${mousePosition.y}px, 0) scale3d(1, 1, 1)`
								: "translate3d(0px, 0px, 0) scale3d(1, 1, 1)",
							transition: "transform 0.1s ease-out",
						}
			}
			className={cn(
				"mx-auto w-full bg-indigo-800 relative rounded-2xl overflow-hidden",
				containerClassName,
			)}
		>
			<div
				className="relative  h-full [background-image:radial-gradient(88%_100%_at_top,rgba(255,255,255,0.5),rgba(255,255,255,0))]  sm:mx-0 sm:rounded-2xl overflow-hidden"
				style={{
					boxShadow:
						"0 10px 32px rgba(34, 42, 53, 0.12), 0 1px 1px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(34, 42, 53, 0.05), 0 4px 6px rgba(34, 42, 53, 0.08), 0 24px 108px rgba(47, 48, 55, 0.10)",
				}}
			>
				<motion.div
					style={
						isSafari
							? {
									transform: "translate3d(0, 0, 0) scale3d(1, 1, 1)",
									transition: "transform 0.1s ease-out",
								}
							: {
									transform: isHovering
										? `translate3d(${-mousePosition.x}px, ${-mousePosition.y}px, 0) scale3d(1.03, 1.03, 1)`
										: "translate3d(0px, 0px, 0) scale3d(1, 1, 1)",
									transition: "transform 0.1s ease-out",
								}
					}
					className={cn("h-full px-4 py-12 sm:px-10 lg:py-16", className)}
				>
					<Noise />
					{children}
				</motion.div>
			</div>
		</motion.section>
	);
};

const Noise = () => {
	return (
		<div
			className="absolute inset-0 w-full h-full scale-[1.2] transform opacity-10 [mask-image:radial-gradient(#fff,transparent,75%)]"
			style={{
				backgroundImage: `
          radial-gradient(circle at 20% 80%, transparent 50%, rgba(120, 119, 198, 0.3) 100%),
          radial-gradient(circle at 80% 20%, transparent 50%, rgba(255, 255, 255, 0.15) 100%),
          radial-gradient(circle at 40% 40%, transparent 50%, rgba(120, 119, 198, 0.15) 100%),
          linear-gradient(135deg, transparent 40%, rgba(255, 255, 255, 0.1) 50%, transparent 60%)
        `,
				backgroundSize: "400px 400px, 300px 300px, 200px 200px, 100px 100px",
				backgroundPosition: "0 0, 100px 100px, 200px 200px, 300px 300px",
				filter: "contrast(1.2) brightness(1.1)",
			}}
		></div>
	);
};
