import { motion } from "motion/react";

export const LoaderFive = ({ text }: { text: string }) => {
	return (
		<div className="font-sans font-bold [--shadow-color:var(--subtle)]">
			{text.split("").map((char, i) => (
				<motion.span
					key={i}
					className="inline-block"
					initial={{ scale: 1, opacity: 0.5 }}
					animate={{
						scale: [1, 1.1, 1],
						textShadow: [
							"0 0 0 var(--shadow-color)",
							"0 0 1px var(--shadow-color)",
							"0 0 0 var(--shadow-color)",
						],
						opacity: [0.5, 1, 0.5],
					}}
					transition={{
						duration: 0.5,
						repeat: Infinity,
						repeatType: "loop",
						delay: i * 0.05,
						ease: "easeInOut" as const,
						repeatDelay: 2,
					}}
				>
					{char === " " ? "\u00A0" : char}
				</motion.span>
			))}
		</div>
	);
};
