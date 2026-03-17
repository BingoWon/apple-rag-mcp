// Animation utilities and configurations

export const fadeInUp = {
	initial: { opacity: 0, y: 20 },
	animate: { opacity: 1, y: 0 },
	exit: { opacity: 0, y: -20 },
	transition: { duration: 0.3, ease: "easeOut" },
};

export const fadeIn = {
	initial: { opacity: 0 },
	animate: { opacity: 1 },
	exit: { opacity: 0 },
	transition: { duration: 0.2 },
};

export const slideInRight = {
	initial: { opacity: 0, x: 20 },
	animate: { opacity: 1, x: 0 },
	exit: { opacity: 0, x: -20 },
	transition: { duration: 0.3, ease: "easeOut" },
};

export const scaleIn = {
	initial: { opacity: 0, scale: 0.95 },
	animate: { opacity: 1, scale: 1 },
	exit: { opacity: 0, scale: 0.95 },
	transition: { duration: 0.2, ease: "easeOut" },
};

export const staggerChildren = {
	animate: {
		transition: {
			staggerChildren: 0.1,
		},
	},
};

// CSS-based animations for better performance
export const cssAnimations = {
	fadeIn: "animate-fade-in",
	slideUp: "animate-slide-up",
	slideDown: "animate-slide-down",
	pulse: "animate-pulse",
	spin: "animate-spin",
	bounce: "animate-bounce",
};

// Intersection Observer for scroll animations
export class ScrollAnimationObserver {
	private observer: IntersectionObserver | null = null;
	private elements: Map<Element, () => void> = new Map();

	constructor() {
		if (typeof window !== "undefined") {
			this.observer = new IntersectionObserver(
				(entries) => {
					entries.forEach((entry) => {
						if (entry.isIntersecting) {
							const callback = this.elements.get(entry.target);
							if (callback) {
								callback();
								this.unobserve(entry.target);
							}
						}
					});
				},
				{
					threshold: 0.1,
					rootMargin: "50px 0px -50px 0px",
				},
			);
		}
	}

	observe(element: Element, callback: () => void): void {
		if (this.observer) {
			this.elements.set(element, callback);
			this.observer.observe(element);
		}
	}

	unobserve(element: Element): void {
		if (this.observer) {
			this.observer.unobserve(element);
			this.elements.delete(element);
		}
	}

	disconnect(): void {
		if (this.observer) {
			this.observer.disconnect();
			this.elements.clear();
		}
	}
}

// Smooth scroll utility
export function smoothScrollTo(elementId: string, offset: number = 0): void {
	const element = document.getElementById(elementId);
	if (element) {
		const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
		const offsetPosition = elementPosition - offset;

		window.scrollTo({
			top: offsetPosition,
			behavior: "smooth",
		});
	}
}

// Page transition utilities
export const pageTransitions = {
	initial: { opacity: 0, y: 20 },
	animate: { opacity: 1, y: 0 },
	exit: { opacity: 0, y: -20 },
	transition: { duration: 0.3, ease: "easeInOut" },
};

// Loading animation configurations
export const loadingAnimations = {
	spinner: {
		animate: { rotate: 360 },
		transition: { duration: 1, repeat: Infinity, ease: "linear" },
	},
	dots: {
		animate: { scale: [1, 1.2, 1] },
		transition: { duration: 0.6, repeat: Infinity, ease: "easeInOut" },
	},
	pulse: {
		animate: { opacity: [0.5, 1, 0.5] },
		transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
	},
};

// Hover animations
export const hoverAnimations = {
	scale: {
		whileHover: { scale: 1.05 },
		whileTap: { scale: 0.95 },
		transition: { duration: 0.2 },
	},
	lift: {
		whileHover: { y: -2, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" },
		transition: { duration: 0.2 },
	},
	glow: {
		whileHover: { boxShadow: "0 0 20px rgba(59, 130, 246, 0.5)" },
		transition: { duration: 0.2 },
	},
};

export const scrollAnimationObserver = new ScrollAnimationObserver();
