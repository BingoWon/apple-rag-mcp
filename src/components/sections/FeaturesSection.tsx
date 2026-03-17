import { IconBolt, IconClock, IconCode, IconSearch, IconShieldCheck } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { GlowingEffect } from "@/components/ui/glowing-effect";

export function FeaturesSection() {
	const { t } = useTranslation();

	const features = [
		{
			name: t("features.lightning_fast"),
			description: t("features.lightning_fast_desc"),
			icon: IconBolt,
			area: "md:[grid-area:1/1/2/7] xl:[grid-area:1/1/2/5]",
		},
		{
			name: t("features.always_secure"),
			description: t("features.always_secure_desc"),
			icon: IconShieldCheck,
			area: "md:[grid-area:1/7/2/13] xl:[grid-area:2/1/3/5]",
		},
		{
			name: t("features.ai_search"),
			description: t("features.ai_search_desc"),
			icon: IconSearch,
			area: "md:[grid-area:2/1/3/7] xl:[grid-area:1/5/3/8]",
		},
		{
			name: t("features.code_examples"),
			description: t("features.code_examples_desc"),
			icon: IconCode,
			area: "md:[grid-area:2/7/3/13] xl:[grid-area:1/8/2/13]",
		},
		{
			name: t("features.realtime_updates"),
			description: t("features.realtime_updates_desc"),
			icon: IconClock,
			area: "md:[grid-area:3/1/4/13] xl:[grid-area:2/8/3/13]",
		},
	];

	return (
		<div
			className="relative bg-gradient-to-b from-background via-background/95 to-background pt-24 pb-20 sm:py-32"
			id="features"
		>
			{/* Subtle background pattern for light mode */}
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.03),transparent_50%)] dark:bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.1),transparent_50%)]" />

			<div className="relative mx-auto max-w-7xl px-6 lg:px-8">
				<div className="mx-auto max-w-4xl lg:text-center">
					<h2 className="text-base font-semibold leading-7 text-brand">{t("features.eyebrow")}</h2>
					<p className="mt-2 text-3xl font-bold tracking-tight text-light sm:text-4xl">
						{t("features.title")}
					</p>
					<p className="mt-6 text-lg leading-8 text-muted">{t("features.subtitle")}</p>
				</div>
				<div className="mx-auto mt-8 max-w-4xl sm:mt-20 lg:mt-24 lg:max-w-6xl">
					<ul className="grid grid-cols-1 grid-rows-none gap-3 md:grid-cols-12 md:grid-rows-3 md:gap-4 lg:gap-4 xl:max-h-[34rem] xl:grid-rows-2">
						{features.map((feature) => (
							<GridItem
								key={feature.name}
								area={feature.area}
								icon={
									<feature.icon
										className="h-6 w-6 text-inverse"
										strokeWidth={2}
										aria-hidden="true"
									/>
								}
								title={feature.name}
								description={feature.description}
							/>
						))}
					</ul>
				</div>
			</div>
		</div>
	);
}

interface GridItemProps {
	area: string;
	icon: React.ReactNode;
	title: string;
	description: React.ReactNode;
}

const GridItem = ({ area, icon, title, description }: GridItemProps) => {
	return (
		<li className={`min-h-[12rem] md:min-h-[14rem] list-none ${area}`}>
			<div className="group relative h-full rounded-2xl border border-border/60 bg-gradient-to-br from-card/70 via-card/50 to-card/30 backdrop-blur-sm p-2 md:rounded-3xl md:p-3 shadow-sm hover:shadow-lg transition-all duration-300 hover:border-border/80">
				<GlowingEffect />
				<div className="relative flex h-full flex-col justify-between gap-4 md:gap-6 overflow-hidden rounded-lg md:rounded-xl px-4 py-3 md:p-6 bg-gradient-to-br from-background/90 via-background/85 to-background/80 backdrop-blur-sm shadow-inner border border-border/30 group-hover:border-border/40 transition-all duration-300">
					{/* Subtle inner glow for light mode */}
					<div className="absolute inset-0 rounded-lg md:rounded-xl bg-gradient-to-br from-white/5 via-transparent to-transparent dark:from-white/10" />

					<div className="relative flex flex-1 flex-col justify-between gap-2 md:gap-3">
						<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand/80 shadow-lg shadow-brand/20 group-hover:shadow-xl group-hover:shadow-brand/30 transition-all duration-300">
							{icon}
						</div>
						<div className="space-y-2 md:space-y-3">
							<h3 className="-tracking-4 pt-0.5 font-sans text-xl/[1.375rem] font-semibold text-balance text-foreground md:text-2xl/[1.875rem] group-hover:text-foreground/90 transition-colors duration-300">
								{title}
							</h3>
							<h2 className="font-sans text-sm/[1.125rem] text-muted-foreground md:text-base/[1.375rem] [&_b]:md:font-semibold [&_strong]:md:font-semibold group-hover:text-muted-foreground/90 transition-colors duration-300">
								{description}
							</h2>
						</div>
					</div>
				</div>
			</div>
		</li>
	);
};
