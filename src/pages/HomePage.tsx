import { Profiler, type ProfilerOnRenderCallback, type ReactNode } from "react";
import { Footer } from "@/components/layout/Footer";
import { CTASection } from "@/components/sections/CTASection";
import { DataSourcesShowcase } from "@/components/sections/DataSourcesSection";
import { FeaturesSection } from "@/components/sections/FeaturesSection";
import { JevSection } from "@/components/sections/JevSection";
import { PricingSection } from "@/components/sections/PricingSection";
import { QuickStartSection } from "@/components/sections/QuickStartSection";
import { TestimonialsSection } from "@/components/sections/TestimonialsSection";
import { HeroSection } from "@/components/ui/hero-section";
import { AppNavbar } from "@/components/ui/resizable-navbar";
import { TracingBeam } from "@/components/ui/tracing-beam";

const reportSectionRender: ProfilerOnRenderCallback = (id, phase, actualDuration, baseDuration) => {
	if (import.meta.env.DEV) {
		console.info("[section-perf]", {
			id,
			phase,
			actualDuration: Math.round(actualDuration * 100) / 100,
			baseDuration: Math.round(baseDuration * 100) / 100,
		});
	}
};

function ProfiledSection({ id, children }: { id: string; children: ReactNode }) {
	if (!import.meta.env.DEV) return <>{children}</>;
	return (
		<Profiler id={id} onRender={reportSectionRender}>
			{children}
		</Profiler>
	);
}

export default function HomePage() {
	return (
		<div className="min-h-screen">
			<ProfiledSection id="AppNavbar">
				<AppNavbar />
			</ProfiledSection>
			<ProfiledSection id="HeroSection">
				<HeroSection />
			</ProfiledSection>
			<ProfiledSection id="JevSection">
				<JevSection />
			</ProfiledSection>
			<TracingBeam>
				<main>
					<ProfiledSection id="FeaturesSection">
						<FeaturesSection />
					</ProfiledSection>
					<ProfiledSection id="QuickStartSection">
						<QuickStartSection />
					</ProfiledSection>
					<ProfiledSection id="DataSourcesShowcase">
						<DataSourcesShowcase />
					</ProfiledSection>
					<ProfiledSection id="TestimonialsSection">
						<TestimonialsSection />
					</ProfiledSection>
					<ProfiledSection id="PricingSection">
						<PricingSection />
					</ProfiledSection>
					<ProfiledSection id="CTASection">
						<CTASection />
					</ProfiledSection>
				</main>
			</TracingBeam>
			<ProfiledSection id="Footer">
				<Footer />
			</ProfiledSection>
		</div>
	);
}
