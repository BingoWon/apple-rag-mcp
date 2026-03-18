import { Footer } from "@/components/layout/Footer";
import { CTASection } from "@/components/sections/CTASection";
import { DataSourcesShowcase } from "@/components/sections/DataSourcesSection";
import { FeaturesSection } from "@/components/sections/FeaturesSection";
import { PricingSection } from "@/components/sections/PricingSection";
import { QuickStartSection } from "@/components/sections/QuickStartSection";
import { TestimonialsSection } from "@/components/sections/TestimonialsSection";
import { HeroSection } from "@/components/ui/hero-section";
import { AppNavbar } from "@/components/ui/resizable-navbar";
import { TracingBeam } from "@/components/ui/tracing-beam";

export default function HomePage() {
	return (
		<div className="min-h-screen">
			<AppNavbar />
			<HeroSection />
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
