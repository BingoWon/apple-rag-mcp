import { useTranslation } from "react-i18next";
import { AnimatedTestimonials } from "@/components/effects/animated-testimonials";
import { JevText } from "@/components/effects/jev-brand";

export function TestimonialsSection() {
	const { t } = useTranslation();

	// Local WebP filenames retain the original images.unsplash.com photo IDs.
	const testimonials = [
		{
			quote: t("testimonials.quote1"),
			name: "Jake Mitchell",
			designation: t("testimonials.designation_1"),
			src: "/images/testimonials/photo-1674767597051-37af3b73c2ca.webp",
		},
		{
			quote: t("testimonials.quote2"),
			name: "Emma O'Sullivan",
			designation: t("testimonials.designation_2"),
			src: "/images/testimonials/photo-1580894908361-967195033215.webp",
		},
		{
			quote: t("testimonials.quote3"),
			name: "Carlos Mendoza",
			designation: t("testimonials.designation_3"),
			src: "/images/testimonials/photo-1555436169-20e93ea9a7ff.webp",
		},
		{
			quote: t("testimonials.quote4"),
			name: "Rebecca Johnson",
			designation: t("testimonials.designation_4"),
			src: "/images/testimonials/photo-1572511443032-a3cfe6823872.webp",
		},
		{
			quote: t("testimonials.quote5"),
			name: "David Patterson",
			designation: t("testimonials.designation_5"),
			src: "/images/testimonials/photo-1522881193457-37ae97c905bf.webp",
		},
	];

	return (
		<section className="home-section bg-background overflow-x-clip" id="testimonials">
			<div className="home-content mb-20 text-center md:mb-24">
				<h2 className="text-base font-semibold leading-7 text-brand">
					{t("testimonials.eyebrow")}
				</h2>
				<p className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
					{t("testimonials.title")}
				</p>
				<p className="mt-4 sm:mt-6 text-lg leading-8 text-muted">
					<JevText i18nKey="testimonials.subtitle" />
				</p>
			</div>

			<div className="mx-auto max-w-7xl px-4 lg:px-8">
				<AnimatedTestimonials testimonials={testimonials} />
			</div>
		</section>
	);
}
