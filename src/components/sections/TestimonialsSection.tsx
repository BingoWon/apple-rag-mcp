import { AnimatedTestimonials } from "@/components/ui/animated-testimonials";

export function TestimonialsSection() {
	const testimonials = [
		{
			quote:
				"I went from zero iOS knowledge to shipping apps without writing a single line of code. This MCP is pure magic for non-developers like me!",
			name: "Jake Mitchell",
			designation: "Indie Developer",
			src: "https://images.unsplash.com/photo-1674767597051-37af3b73c2ca?q=80&w=2168&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
		},
		{
			quote:
				"LLMs were decent, but never quite hit the mark for serious Apple development. This MCP changes everything - finally, AI that truly gets Apple's ecosystem.",
			name: "Emma O'Sullivan",
			designation: "macOS Development Engineer",
			src: "https://images.unsplash.com/photo-1580894908361-967195033215?q=80&w=2370&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
		},
		{
			quote:
				"I've been looking for this kind of solution for a while and even evaluated building something similar internally. The execution here is solid and well-architected.",
			name: "Carlos Mendoza",
			designation: "Senior iOS Architect",
			src: "https://images.unsplash.com/photo-1555436169-20e93ea9a7ff?q=80&w=2370&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
		},
		{
			quote:
				"Whoever designed these pricing tiers is brilliant. Perfect balance of accessibility and value - fits my workflow like a glove.",
			name: "Rebecca Johnson",
			designation: "Freelance App Developer",
			src: "https://images.unsplash.com/photo-1572511443032-a3cfe6823872?q=80&w=2371&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
		},
		{
			quote:
				"Great to see quality commercial MCP products like this. It's good for the ecosystem and shows developers can actually make money doing this right.",
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
					<h2 className="text-base font-semibold leading-7 text-brand">Happy Vibes</h2>
					<p className="mt-2 text-3xl font-bold tracking-tight text-light sm:text-4xl">
						Developers Are Loving This!
					</p>
					<p className="mt-4 sm:mt-6 text-lg leading-8 text-muted max-w-2xl mx-auto">
						Discover why developers are making our Apple RAG MCP a core part of their stack.
					</p>
				</div>

				{/* Testimonials Component */}
				<AnimatedTestimonials testimonials={testimonials} />
			</div>
		</section>
	);
}
