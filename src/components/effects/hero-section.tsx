import { MacbookScroll } from "@/components/effects/macbook-scroll";
import { Spotlight } from "@/components/effects/spotlight";

export function HeroSection() {
	return (
		<div className="w-full overflow-hidden bg-background/[0.96] antialiased relative -mt-20 pt-12">
			<Spotlight />
			<div className="relative z-10 pt-30">
				<div className="[&>div]:!bg-transparent">
					<MacbookScroll />
				</div>
			</div>
		</div>
	);
}
