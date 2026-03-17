import { motion } from "motion/react";

// Spotlight configuration constants
const GRADIENTS = {
	first:
		"radial-gradient(68.54% 68.72% at 55.02% 31.46%, hsla(210, 100%, 85%, .09) 0, hsla(210, 100%, 55%, .03) 50%, hsla(210, 100%, 45%, .01) 80%)",
	second:
		"radial-gradient(50% 50% at 50% 50%, hsla(210, 100%, 85%, .06) 0, hsla(210, 100%, 55%, .02) 80%, transparent 100%)",
	third:
		"radial-gradient(50% 50% at 50% 50%, hsla(210, 100%, 85%, .05) 0, hsla(210, 100%, 45%, .02) 80%, transparent 100%)",
};

const DIMENSIONS = {
	translateY: -350,
	width: 560,
	height: 1380,
	smallWidth: 240,
};

const ANIMATION = {
	duration: 7,
	xOffset: 100,
};

export const Spotlight = () => {
	return (
		<motion.div
			initial={{
				opacity: 0,
			}}
			animate={{
				opacity: 1,
			}}
			transition={{
				duration: 1.5,
			}}
			className="pointer-events-none absolute inset-0 h-full w-full"
		>
			<motion.div
				animate={{
					x: [0, ANIMATION.xOffset, 0],
				}}
				transition={{
					duration: ANIMATION.duration,
					repeat: Infinity,
					repeatType: "reverse",
					ease: "easeInOut",
				}}
				className="absolute top-0 left-0 w-screen h-screen z-40 pointer-events-none"
			>
				<div
					style={{
						transform: `translateY(${DIMENSIONS.translateY}px) rotate(-45deg)`,
						background: GRADIENTS.first,
						width: `${DIMENSIONS.width}px`,
						height: `${DIMENSIONS.height}px`,
					}}
					className="absolute top-0 left-0"
				/>

				<div
					style={{
						transform: "rotate(-45deg) translate(5%, -50%)",
						background: GRADIENTS.second,
						width: `${DIMENSIONS.smallWidth}px`,
						height: `${DIMENSIONS.height}px`,
					}}
					className="absolute top-0 left-0 origin-top-left"
				/>

				<div
					style={{
						transform: "rotate(-45deg) translate(-180%, -70%)",
						background: GRADIENTS.third,
						width: `${DIMENSIONS.smallWidth}px`,
						height: `${DIMENSIONS.height}px`,
					}}
					className="absolute top-0 left-0 origin-top-left"
				/>
			</motion.div>

			<motion.div
				animate={{
					x: [0, -ANIMATION.xOffset, 0],
				}}
				transition={{
					duration: ANIMATION.duration,
					repeat: Infinity,
					repeatType: "reverse",
					ease: "easeInOut",
				}}
				className="absolute top-0 right-0 w-screen h-screen z-40 pointer-events-none"
			>
				<div
					style={{
						transform: `translateY(${DIMENSIONS.translateY}px) rotate(45deg)`,
						background: GRADIENTS.first,
						width: `${DIMENSIONS.width}px`,
						height: `${DIMENSIONS.height}px`,
					}}
					className="absolute top-0 right-0"
				/>

				<div
					style={{
						transform: "rotate(45deg) translate(-5%, -50%)",
						background: GRADIENTS.second,
						width: `${DIMENSIONS.smallWidth}px`,
						height: `${DIMENSIONS.height}px`,
					}}
					className="absolute top-0 right-0 origin-top-right"
				/>

				<div
					style={{
						transform: "rotate(45deg) translate(180%, -70%)",
						background: GRADIENTS.third,
						width: `${DIMENSIONS.smallWidth}px`,
						height: `${DIMENSIONS.height}px`,
					}}
					className="absolute top-0 right-0 origin-top-right"
				/>
			</motion.div>

			{/* Additional light mode enhancement */}
			<div className="absolute inset-0 bg-gradient-to-br from-blue-50/10 via-transparent to-purple-50/10 dark:from-transparent dark:to-transparent pointer-events-none z-30" />
		</motion.div>
	);
};
