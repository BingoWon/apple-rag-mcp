import { useTranslation } from "react-i18next";
import { AnimatedTestimonials } from "@/components/ui/animated-testimonials";

export function TestimonialsSection() {
	const { t } = useTranslation();

	const testimonials = [
		{
			quote: t("testimonials.quote1"),
			name: "Jake Mitchell",
			designation: "Indie Developer",
			src: "https://images.unsplash.com/photo-1674767597051-37af3b73c2ca?q=80&w=2168&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
		},
		{
			quote: t("testimonials.quote2"),
			name: "Emma O'Sullivan",
			designation: "macOS Development Engineer",
			src: "https://images.unsplash.com/photo-1580894908361-967195033215?q=80&w=2370&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
		},
		{
			quote: t("testimonials.quote3"),
			name: "Carlos Mendoza",
			designation: "Senior iOS Architect",
			src: "https://images.unsplash.com/photo-1555436169-20e93ea9a7ff?q=80&w=2370&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
		},
		{
			quote: t("testimonials.quote4"),
			name: "Rebecca Johnson",
			designation: "Freelance App Developer",
			src: "https://images.unsplash.com/photo-1572511443032-a3cfe6823872?q=80&w=2371&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
		},
		{
			quote: t("testimonials.quote5"),
			name: "David Patterson",
			designation: "MCP Platform Expert",
			src: "https://images.unsplash.com/photo-1522881193457-37ae97c905bf?q=80&w=2370&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
		},
	];

	return (
		<section className="py-16 md:py-24 bg-background" id="testimonials">
			<div className="mx-auto max-w-7xl px-4 lg:px-8">
				{/* Section Header */}
				<div className="text-center mb-0 md:mb-8">
					<h2 className="text-base font-semibold leading-7 text-brand">
						{t("testimonials.eyebrow")}
					</h2>
					<p className="mt-2 text-3xl font-bold tracking-tight text-light sm:text-4xl">
						{t("testimonials.title")}
					</p>
					<p className="mt-4 sm:mt-6 text-lg leading-8 text-muted max-w-2xl mx-auto">
						{t("testimonials.subtitle")}
					</p>
				</div>

				{/* Testimonials Component */}
				<AnimatedTestimonials testimonials={testimonials} />
			</div>
		</section>
	);
}
