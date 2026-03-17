import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowButton } from "@/components/ui/arrow-button";
import { Button } from "@/components/ui/Button";
import { TypewriterEffectSmooth } from "@/components/ui/typewriter-effect";

export function CTASection() {
	const { t } = useTranslation();

	const words = [
		{
			text: t("cta.ready"),
			className: "text-light",
		},
		{
			text: t("cta.to"),
			className: "text-light",
		},
		{
			text: t("cta.empower"),
			className: "text-light",
		},
		{
			text: t("cta.your"),
			className: "text-light",
		},
		{
			text: t("cta.ai_agents"),
			className: "text-brand-secondary",
		},
	];

	return (
		<div className="relative overflow-hidden rounded-xl">
			{/* Vertical Fade Mask - Creates transparent fade at top and bottom */}
			<div
				className="absolute inset-0"
				style={{
					mask: "linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)",
					WebkitMask:
						"linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
				}}
			>
				<div className="absolute inset-0 bg-gradient-to-br from-secondary via-tertiary to-secondary"></div>
				<div className="absolute inset-0 bg-gradient-to-r from-brand/10 via-transparent to-brand/10"></div>
				<div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(96,165,250,0.1),transparent_50%)] dark:bg-[radial-gradient(circle_at_30%_20%,rgba(96,165,250,0.05),transparent_50%)]"></div>
				<div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(96,165,250,0.1),transparent_50%)] dark:bg-[radial-gradient(circle_at_70%_80%,rgba(96,165,250,0.05),transparent_50%)]"></div>
			</div>

			{/* Content */}
			<div className="relative px-6 py-32 sm:px-6 sm:py-40 lg:px-8">
				<div className="mx-auto max-w-5xl text-center">
					<TypewriterEffectSmooth words={words} />
					<p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-light/90">
						<span className="font-extrabold text-white bg-gradient-to-r from-brand to-brand-secondary px-2 py-1 rounded-lg text-xl tracking-wide transform -rotate-5 inline-block hover:rotate-0 transition-transform duration-300">
							Vibe Coding
						</span>{" "}
						{t("cta.subtitle")}
					</p>
					<div className="mt-10 flex items-center justify-center gap-x-6">
						<ArrowButton />
						<Link to="/docs" className="hidden">
							<Button
								variant="ghost"
								size="lg"
								className="text-light hover:bg-light/10 border border-light/30"
							>
								Learn more <span aria-hidden="true">→</span>
							</Button>
						</Link>
					</div>
				</div>
			</div>
		</div>
	);
}
