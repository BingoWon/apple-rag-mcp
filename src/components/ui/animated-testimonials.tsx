import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";

import { useEffect, useState } from "react";

type Testimonial = {
	quote: string;
	name: string;
	designation: string;
	src: string;
};
export const AnimatedTestimonials = ({
	testimonials,
	autoplay = false,
}: {
	testimonials: Testimonial[];
	autoplay?: boolean;
}) => {
	const [active, setActive] = useState(0);

	const handleNext = () => {
		setActive((prev) => (prev + 1) % testimonials.length);
	};

	const handlePrev = () => {
		setActive((prev) => (prev - 1 + testimonials.length) % testimonials.length);
	};

	const isActive = (index: number) => {
		return index === active;
	};

	useEffect(() => {
		if (autoplay) {
			const interval = setInterval(handleNext, 5000);
			return () => clearInterval(interval);
		}
	}, [autoplay, handleNext]);

	const [rotationValues, setRotationValues] = useState<number[]>([]);

	useEffect(() => {
		// 只在客户端生成随机旋转值，避免 hydration 不匹配
		const values = testimonials.map(() => Math.floor(Math.random() * 21) - 10);
		setRotationValues(values);
	}, [testimonials.map]);

	const getRotateY = (index: number) => {
		return rotationValues[index] || 0;
	};
	return (
		<section className="mx-auto max-w-7xl px-4 py-16 md:py-24 lg:px-8">
			<div className="relative grid grid-cols-1 gap-12 md:gap-20 md:grid-cols-2">
				<div>
					<div className="relative h-80 w-full">
						<AnimatePresence>
							{testimonials.map((testimonial, index) => (
								<motion.div
									key={testimonial.src}
									initial={{
										opacity: 0,
										scale: 0.9,
										z: -100,
										rotate: getRotateY(index),
									}}
									animate={{
										opacity: isActive(index) ? 1 : 0.7,
										scale: isActive(index) ? 1 : 0.95,
										z: isActive(index) ? 0 : -100,
										rotate: isActive(index) ? 0 : getRotateY(index),
										zIndex: isActive(index) ? 10 : testimonials.length + 2 - index,
										y: isActive(index) ? [0, -80, 0] : 0,
									}}
									exit={{
										opacity: 0,
										scale: 0.9,
										z: 100,
										rotate: getRotateY(index),
									}}
									transition={{
										duration: 0.4,
										ease: [0.4, 0, 0.2, 1],
									}}
									className="absolute inset-0 origin-bottom"
								>
									<img
										src={testimonial.src}
										alt={testimonial.name}
										width={500}
										height={500}
										draggable={false}
										className="h-full w-full rounded-2xl object-cover object-center shadow-complex border border-default"
									/>
								</motion.div>
							))}
						</AnimatePresence>
					</div>
				</div>
				<div className="flex flex-col justify-between py-4">
					<motion.div
						key={active}
						initial={{
							y: 20,
							opacity: 0,
						}}
						animate={{
							y: 0,
							opacity: 1,
						}}
						exit={{
							y: -20,
							opacity: 0,
						}}
						transition={{
							duration: 0.2,
							ease: [0.4, 0, 0.2, 1],
						}}
					>
						<h3 className="text-2xl font-bold text-light">{testimonials[active].name}</h3>
						<p className="text-sm text-muted mt-1">{testimonials[active].designation}</p>
						<motion.p className="mt-8 text-lg text-subtle leading-relaxed">
							{testimonials[active].quote.split(" ").map((word, index) => (
								<motion.span
									key={index}
									initial={{
										filter: "blur(10px)",
										opacity: 0,
										y: 5,
									}}
									animate={{
										filter: "blur(0px)",
										opacity: 1,
										y: 0,
									}}
									transition={{
										duration: 0.2,
										ease: [0.4, 0, 0.2, 1],
										delay: 0.02 * index,
									}}
									className="inline-block"
								>
									{word}&nbsp;
								</motion.span>
							))}
						</motion.p>
					</motion.div>
					<div className="flex gap-4 pt-12 md:pt-0">
						<button
							onClick={handlePrev}
							className="group/button flex h-10 w-10 items-center justify-center rounded-xl bg-card border border-default hover:border-brand hover:bg-accent transition-all duration-200 shadow-button"
						>
							<IconArrowLeft className="h-5 w-5 text-light transition-all duration-200 group-hover/button:rotate-12 group-hover/button:text-brand" />
						</button>
						<button
							onClick={handleNext}
							className="group/button flex h-10 w-10 items-center justify-center rounded-xl bg-card border border-default hover:border-brand hover:bg-accent transition-all duration-200 shadow-button"
						>
							<IconArrowRight className="h-5 w-5 text-light transition-all duration-200 group-hover/button:-rotate-12 group-hover/button:text-brand" />
						</button>
					</div>
				</div>
			</div>
		</section>
	);
};
