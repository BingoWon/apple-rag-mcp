import { useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { GoogleGeminiEffect } from "@/components/ui/google-gemini-effect";

export function JevSection() {
	const ref = useRef<HTMLDivElement>(null);
	const { t } = useTranslation();
	const { scrollYProgress } = useScroll({
		target: ref,
		offset: ["start center", "end start"],
	});

	const pathLengthFirst = useTransform(scrollYProgress, [0, 0.6], [0.2, 1.2]);
	const pathLengthSecond = useTransform(scrollYProgress, [0, 0.6], [0.15, 1.2]);
	const pathLengthThird = useTransform(scrollYProgress, [0, 0.6], [0.1, 1.2]);
	const pathLengthFourth = useTransform(scrollYProgress, [0, 0.6], [0.05, 1.2]);
	const pathLengthFifth = useTransform(scrollYProgress, [0, 0.6], [0, 1.2]);

	return (
		<div
			id="jev"
			className="relative h-[160svh] w-full overflow-clip bg-background pt-20 sm:h-[180svh] sm:pt-24"
			ref={ref}
		>
			<GoogleGeminiEffect
				title={t("jev.title")}
				description={t("jev.description")}
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
