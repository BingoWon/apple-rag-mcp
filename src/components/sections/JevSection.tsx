import { useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { GoogleGeminiEffect } from "@/components/ui/google-gemini-effect";

export function JevSection() {
	const ref = useRef<HTMLDivElement>(null);
	const { t } = useTranslation();
	const { scrollYProgress } = useScroll({
		target: ref,
		offset: ["start start", "end start"],
	});

	const pathLengthFirst = useTransform(scrollYProgress, [0, 0.8], [0.2, 1.2]);
	const pathLengthSecond = useTransform(scrollYProgress, [0, 0.8], [0.15, 1.2]);
	const pathLengthThird = useTransform(scrollYProgress, [0, 0.8], [0.1, 1.2]);
	const pathLengthFourth = useTransform(scrollYProgress, [0, 0.8], [0.05, 1.2]);
	const pathLengthFifth = useTransform(scrollYProgress, [0, 0.8], [0, 1.2]);

	return (
		<div
			id="jev"
			className="h-[400vh] bg-black w-full dark:border dark:border-white/[0.1] rounded-md relative pt-40 overflow-clip"
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
