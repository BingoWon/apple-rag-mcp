import { useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { Trans } from "react-i18next";
import { GoogleGeminiEffect } from "@/components/ui/google-gemini-effect";
import { JevBrand } from "@/components/ui/jev-brand";

export function JevSection() {
	const ref = useRef<HTMLDivElement>(null);
	const { scrollYProgress } = useScroll({
		target: ref,
		offset: ["start end", "center center"],
	});

	const pathLengthFirst = useTransform(scrollYProgress, [0, 1], [0.2, 1.2]);
	const pathLengthSecond = useTransform(scrollYProgress, [0, 1], [0.15, 1.2]);
	const pathLengthThird = useTransform(scrollYProgress, [0, 1], [0.1, 1.2]);
	const pathLengthFourth = useTransform(scrollYProgress, [0, 1], [0.05, 1.2]);
	const pathLengthFifth = useTransform(scrollYProgress, [0, 1], [0, 1.2]);

	return (
		<div
			id="jev"
			className="relative flex min-h-[65svh] w-full items-center justify-center overflow-clip bg-background py-16 sm:py-20"
			ref={ref}
		>
			<GoogleGeminiEffect
				title={<JevBrand />}
				description={<Trans i18nKey="jev.description" components={{ jev: <JevBrand /> }} />}
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
