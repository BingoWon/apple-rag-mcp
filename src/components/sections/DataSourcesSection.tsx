import { useTranslation } from "react-i18next";
import { WobbleCard } from "../ui/wobble-card";

export function DataSourcesShowcase() {
	const { t } = useTranslation();
	return (
		<div className="relative pb-24">
			<div className="mx-auto max-w-7xl px-6 lg:px-8">
				<div className="mx-auto max-w-4xl lg:text-center mb-16">
					<h2 className="text-base font-semibold leading-7 text-brand">
						{t("datasources.eyebrow")}
					</h2>
					<p className="mt-2 text-3xl font-bold tracking-tight text-light sm:text-4xl">
						{t("datasources.title")}
					</p>
					<p className="mt-6 text-lg leading-8 text-muted">{t("datasources.subtitle")}</p>
				</div>
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-4 w-full">
					<WobbleCard
						containerClassName="col-span-1 lg:col-span-2 h-full bg-pink-800 min-h-[440px] lg:min-h-[250px] cursor-pointer"
						className=""
						onClick={() => window.open("https://developer.apple.com/documentation", "_blank")}
					>
						<div className="max-w-xs relative z-10">
							<h2 className="text-left text-balance text-xl lg:text-3xl font-semibold tracking-[-0.015em] text-white">
								{t("datasources.docs_title")}
							</h2>
							<p className="mt-4 text-left  text-base/6 text-neutral-200">
								{t("datasources.docs_desc")}
							</p>
						</div>
						<img
							src="/Apple Developer Documentation.jpeg"
							width={400}
							height={500}
							alt="Apple Developer Documentation"
							className="absolute -right-4 lg:-right-[10%] -bottom-10 object-contain rounded-2xl z-0"
						/>
					</WobbleCard>
					<WobbleCard containerClassName="col-span-1 min-h-[150px] md:min-h-[250px]">
						<h2 className="max-w-80 text-left text-balance text-xl lg:text-3xl font-semibold tracking-[-0.015em] text-white">
							{t("datasources.fight_title")}
						</h2>
						<p className="mt-4 max-w-[26rem] text-left  text-base/6 text-neutral-200">
							{t("datasources.fight_desc")}
						</p>
						<img
							src="/muscle-sticker.png"
							width={60}
							height={60}
							alt="Muscle sticker"
							className="absolute top-0 right-1 w-15 h-15 md:w-20 md:h-20 object-contain transform rotate-12 hover:rotate-[20deg] transition-transform duration-300"
						/>
					</WobbleCard>
					<WobbleCard
						containerClassName="col-span-1 lg:col-span-3 bg-brand-tertiary/80 min-h-[440px] xl:min-h-[250px] cursor-pointer"
						onClick={() => window.open("https://developer.apple.com/videos/", "_blank")}
					>
						<div className="max-w-sm relative z-10">
							<h2 className="max-w-sm md:max-w-lg  text-left text-balance text-xl lg:text-3xl font-semibold tracking-[-0.015em] text-white">
								{t("datasources.videos_title")}
							</h2>
							<p className="mt-4 max-w-[26rem] text-left  text-base/6 text-neutral-200">
								{t("datasources.videos_desc")}
							</p>
						</div>
						<img
							src="/Apple Developer Videos.jpeg"
							width={600}
							height={500}
							alt="Apple Developer Videos"
							className="absolute -right-4 -bottom-0  lg:right-[2%] lg:-bottom-20 object-contain rounded-2xl z-0"
						/>
					</WobbleCard>
				</div>
			</div>
		</div>
	);
}
