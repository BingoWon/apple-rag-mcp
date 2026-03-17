import { MacbookScroll } from "@/components/ui/macbook-scroll";
import { Spotlight } from "@/components/ui/spotlight";

export function HeroSection() {
	return (
		<div className="w-full overflow-hidden bg-primary/[0.96] antialiased bg-grid-light/[0.02] relative -mt-20 pt-12">
			<Spotlight />
			<div className="relative z-10 pt-30">
				<div className="[&>div]:!bg-transparent">
					<MacbookScroll />
				</div>
			</div>
		</div>
	);
}
