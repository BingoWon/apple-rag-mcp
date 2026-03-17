import { motion, useMotionTemplate, useMotionValue } from "motion/react";
import type React from "react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

export const EvervaultCard = ({
	children,
	className,
	gradientFrom = "from-green-500",
	gradientTo = "to-brand-tertiary",
}: {
	children: React.ReactNode;
	className?: string;
	gradientFrom?: string;
	gradientTo?: string;
}) => {
	const mouseX = useMotionValue(0);
	const mouseY = useMotionValue(0);

	const [randomString, setRandomString] = useState("");
	const cardRef = useRef<HTMLDivElement>(null);

	// No initial character generation - only on mouse move

	function onMouseMove({ currentTarget, clientX, clientY }: any) {
		const { left, top } = currentTarget.getBoundingClientRect();
		mouseX.set(clientX - left);
		mouseY.set(clientY - top);

		// Generate characters only on mouse move for dynamic effect
		const str = generateRandomString(2350);
		setRandomString(str);
	}

	return (
		<div
			ref={cardRef}
			onMouseMove={onMouseMove}
			className={cn("bg-transparent w-full h-full relative", className)}
		>
			<div className="group/card w-full relative overflow-hidden bg-transparent h-full">
				<CardPattern
					mouseX={mouseX}
					mouseY={mouseY}
					randomString={randomString}
					gradientFrom={gradientFrom}
					gradientTo={gradientTo}
				/>
				<div className="relative w-full h-full p-6">
					<div className="relative w-full h-full">
						{/* Background with edge feathering for content readability */}
						<div className="absolute inset-0 bg-background/90 blur-sm" />
						{/* Children content */}
						<div className="relative p-4">{children}</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export function CardPattern({ mouseX, mouseY, randomString, gradientFrom, gradientTo }: any) {
	const maskImage = useMotionTemplate`radial-gradient(250px at ${mouseX}px ${mouseY}px, white, transparent)`;

	return (
		<div className="pointer-events-none absolute inset-0">
			<div className="absolute inset-0 [mask-image:linear-gradient(white,transparent)] group-hover/card:opacity-50 transition-opacity duration-500"></div>
			<motion.div
				className={`absolute inset-0 bg-gradient-to-r ${gradientFrom} ${gradientTo} opacity-0 group-hover/card:opacity-100 backdrop-blur-xl transition-all duration-500`}
				style={{
					maskImage,
					WebkitMaskImage: maskImage,
				}}
			/>
			<motion.div
				className="absolute inset-0 opacity-0 mix-blend-overlay group-hover/card:opacity-100 transition-opacity duration-500"
				style={{
					maskImage,
					WebkitMaskImage: maskImage,
				}}
			>
				<p className="absolute inset-0 text-xs break-words whitespace-pre-wrap text-primary-foreground font-mono font-bold overflow-hidden leading-4">
					{randomString}
				</p>
			</motion.div>
		</div>
	);
}

const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export const generateRandomString = (length: number) => {
	let result = "";
	for (let i = 0; i < length; i++) {
		result += characters.charAt(Math.floor(Math.random() * characters.length));
	}
	return result;
};

export const Icon = ({ className, ...rest }: any) => {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			strokeWidth="1.5"
			stroke="currentColor"
			className={className}
			{...rest}
		>
			<path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
		</svg>
	);
};
