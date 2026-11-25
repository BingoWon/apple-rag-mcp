import { useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { GoogleGeminiEffect } from "@/components/effects/google-gemini-effect";
import { JevText } from "@/components/effects/jev-brand";

export function JevSection() {
	const drawingRef = useRef<HTMLDivElement>(null);
	const { scrollYProgress } = useScroll({
		target: drawingRef,
		offset: ["start end", "center center"],
	});

	const pathLengthFirst = useTransform(scrollYProgress, [0, 1], [0, 1]);
	const pathLengthSecond = useTransform(scrollYProgress, [0.03, 1], [0, 1]);
	const pathLengthThird = useTransform(scrollYProgress, [0.06, 1], [0, 1]);
	const pathLengthFourth = useTransform(scrollYProgress, [0.09, 1], [0, 1]);
	const pathLengthFifth = useTransform(scrollYProgress, [0.12, 1], [0, 1]);

	return (
		<div
			id="jev"
			className="home-section relative flex w-full items-center justify-center overflow-clip bg-background"
		>
			<GoogleGeminiEffect
				title={<JevText i18nKey="jev.title" />}
				description={<JevText i18nKey="jev.description" />}
				drawingRef={drawingRef}
				pathLengths={[
					pathLengthFirst,
					pathLengthSecond,
					pathLengthThird,
					pathLengthFourth,
					pathLengthFifth,
				]}
			/>
		</div>
	);
}
