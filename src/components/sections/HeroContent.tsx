import { IconBrandGithub } from "@tabler/icons-react";
import type React from "react";
import { useTranslation } from "react-i18next";
import { ArrowButton } from "@/components/ui/arrow-button";
import ColourfulText from "@/components/ui/colourful-text";
import { cn } from "@/lib/utils";

export const HeroContent: React.FC = () => {
	const { t } = useTranslation();
	// Rainbow button styles - organized for better maintainability
	const rainbowButtonStyles = cn(
		// Base layout and interaction - Safari optimized
		"relative inline-flex items-center justify-center h-12 px-4 py-2",
		"rounded-xl text-sm font-medium whitespace-nowrap cursor-pointer border-0",
		"transition-transform duration-200 hover:scale-105 active:scale-95",
		"will-change-transform [transform:translateZ(0)]", // Force hardware acceleration

		// Focus and accessibility
		"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
		"disabled:pointer-events-none disabled:opacity-50",

		// Rainbow background
		"bg-[linear-gradient(#fff,#fff),linear-gradient(#fff_50%,rgba(255,255,255,0.6)_80%,rgba(0,0,0,0)),linear-gradient(90deg,rgb(16,185,129),rgb(132,204,22),rgb(245,158,11),rgb(249,115,22),rgb(239,68,68),rgb(220,38,127),rgb(168,85,247),rgb(147,51,234),rgb(79,70,229),rgb(59,130,246))]",
		"bg-[length:100%] [background-clip:padding-box,border-box,border-box] [background-origin:border-box]",
		"[border:calc(0.08*1rem)_solid_transparent]",

		// Blur effect pseudo-element - Safari optimized
		"before:absolute before:bottom-[-20%] before:left-1/2 before:z-[0] before:h-[20%] before:w-[90%]",
		"before:-translate-x-1/2",
		"before:bg-[linear-gradient(90deg,rgb(16,185,129),rgb(132,204,22),rgb(245,158,11),rgb(249,115,22),rgb(239,68,68),rgb(220,38,127),rgb(168,85,247),rgb(147,51,234),rgb(79,70,229),rgb(59,130,246))]",
		"before:[filter:blur(calc(0.8*1rem))]",
		"before:transition-opacity before:duration-200 before:will-change-transform",
		"before:[transform:translateZ(0)]", // Force hardware acceleration for Safari

		// Dark mode
		"dark:bg-[linear-gradient(#121213,#121213),linear-gradient(#121213_50%,rgba(18,18,19,0.6)_80%,rgba(18,18,19,0)),linear-gradient(90deg,rgb(16,185,129),rgb(132,204,22),rgb(245,158,11),rgb(249,115,22),rgb(239,68,68),rgb(220,38,127),rgb(168,85,247),rgb(147,51,234),rgb(79,70,229),rgb(59,130,246))]",
	);
	return (
		<div className="mb-0 px-4 text-center text-3xl font-bold text-light md:mb-36 md:px-0" id="hero">
			<div className="text-center md:mb-20">
				<h1 className="text-4xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-light to-muted mb-8 max-w-5xl mx-auto leading-tight">
					{t("hero.title_inject")} <ColourfulText text={t("hero.title_apple")} />
					<br />
					{t("hero.title_into")}
				</h1>
				<p className="text-lg text-muted max-w-3xl mx-auto">
					{t("hero.subtitle_heres")}{" "}
					<span className="font-extrabold text-white bg-gradient-to-r from-brand to-brand-secondary px-2 py-1 rounded-lg text-xl tracking-wide transform -rotate-2 inline-block hover:rotate-0 transition-transform duration-300">
						{t("hero.subtitle_vibecoders")}
					</span>
					{t("hero.subtitle_desc")}
				</p>

				{/* CTA Buttons */}
				<div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-12 mt-8">
					{/* GitHub Button */}
					<a
						href="https://github.com/BingoWon/apple-rag-mcp"
						target="_blank"
						rel="noopener noreferrer"
						className={rainbowButtonStyles}
					>
						<div className="flex items-center">
							<IconBrandGithub className="size-5 text-white" />
							<span className="ml-2 text-white lg:inline p-1 text-base font-semibold">
								{t("nav.star_github")}
							</span>
						</div>
					</a>

					{/* Get Started Button */}
					<ArrowButton />
				</div>
			</div>
		</div>
	);
};
