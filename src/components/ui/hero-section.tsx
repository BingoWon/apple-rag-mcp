import { lazy, Suspense } from "react";
import { MacbookScroll } from "@/components/ui/macbook-scroll";
import { Spotlight } from "@/components/ui/spotlight";

const LocalHero = import.meta.env.DEV ? lazy(() => import("@/dev/HeroDebug")) : null;

export function HeroSection() {
	return (
		<div className="w-full overflow-hidden bg-primary/[0.96] antialiased bg-grid-light/[0.02] relative -mt-20 pt-12">
			<Spotlight />
			<div className="relative z-10 pt-30">
				<div className="[&>div]:!bg-transparent">
					{LocalHero && ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname) ? (
						<Suspense fallback={null}>
							<LocalHero />
						</Suspense>
					) : (
						<MacbookScroll />
					)}
				</div>
			</div>
		</div>
	);
}
