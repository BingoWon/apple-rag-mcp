import { lazy } from "react";
import { Footer } from "@/components/layout/Footer";
import { CTASection } from "@/components/sections/CTASection";
import { DataSourcesShowcase } from "@/components/sections/DataSourcesSection";
import { FeaturesSection } from "@/components/sections/FeaturesSection";
import { PricingSection } from "@/components/sections/PricingSection";
import { QuickStartSection } from "@/components/sections/QuickStartSection";
import { TestimonialsSection } from "@/components/sections/TestimonialsSection";
import { AppNavbar } from "@/components/ui/resizable-navbar";
import { TracingBeam } from "@/components/ui/tracing-beam";

const HeroSection = lazy(() =>
	import("@/components/ui/hero-section").then(({ HeroSection }) => ({ default: HeroSection })),
);

export default function HomePage() {
	const disableHero =
		import.meta.env.DEV && new URLSearchParams(window.location.search).get("disableHero") === "1";

	return (
		<div className="min-h-screen">
			<AppNavbar />
			{!disableHero && <HeroSection />}
			<TracingBeam>
				<main>
					<FeaturesSection />
					<QuickStartSection />
					<DataSourcesShowcase />
					<TestimonialsSection />
					<PricingSection />
					<CTASection />
				</main>
			</TracingBeam>
			<Footer />
		</div>
	);
}
