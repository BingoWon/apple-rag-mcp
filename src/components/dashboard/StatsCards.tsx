import type { Icon } from "@tabler/icons-react";
import { IconCircleCheck, IconDatabase, IconFileText, IconVideo } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/Card";

interface StatCard {
	icon: Icon;
	value: string;
	labelKey: string;
	color: string;
	clickable: boolean;
	url?: string;
}

const StatsCards = () => {
	const { t, i18n } = useTranslation();

	const stats: StatCard[] = [
		{
			icon: IconFileText,
			value: "373,047",
			labelKey: "dashboard.stats_doc_pages",
			color: "#9595ff",
			clickable: true,
			url: "https://developer.apple.com/documentation",
		},
		{
			icon: IconVideo,
			value: "1,409",
			labelKey: "dashboard.stats_wwdc_videos",
			color: "#fca147",
			clickable: true,
			url: "https://developer.apple.com/videos/",
		},
		{
			icon: IconDatabase,
			value: "396,516",
			labelKey: "dashboard.stats_chunks",
			color: "#42c16e",
			clickable: false,
		},
		{
			icon: IconCircleCheck,
			value: "100%",
			labelKey: "dashboard.stats_embedded",
			color: "#dc5bb7",
			clickable: false,
		},
	];

	const handleCardClick = (stat: StatCard) => {
		if (stat.clickable && stat.url) {
			window.open(stat.url, "_blank");
		}
	};

	const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toLocaleDateString(
		i18n.language === "zh" ? "zh-CN" : "en-US",
		{ year: "numeric", month: "short", day: "numeric" },
	);

	return (
		<Card className="mb-6">
			<CardContent className="p-6">
				<div className="flex justify-center mb-5">
					<div className="flex w-auto items-center space-x-2 rounded-full bg-brand px-1.5 py-1 whitespace-pre">
						<div className="w-fit rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-brand sm:text-sm text-center flex items-center gap-1">
							<IconCircleCheck className="w-4 h-4" />
							<span className="hidden sm:inline">{t("dashboard.stats_status")}</span>
						</div>
						<p className="text-xs font-semibold text-white sm:text-base pr-2">
							{t("dashboard.stats_freshness")}
						</p>
					</div>
				</div>
				<div className="text-center mb-5">
					<h3 className="text-xl font-bold text-light mb-2">{t("dashboard.stats_heading")}</h3>
					<p className="text-muted text-sm opacity-75">
						{t("dashboard.stats_date", { date: yesterdayDate })}
					</p>
				</div>
				<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
					{stats.map((stat, index) => {
						const StatIcon = stat.icon;
						const handleKeyDown = (e: React.KeyboardEvent) => {
							if (stat.clickable && (e.key === "Enter" || e.key === " ")) {
								e.preventDefault();
								handleCardClick(stat);
							}
						};
						return (
							// biome-ignore lint/a11y/noStaticElementInteractions: conditionally interactive based on stat.clickable
							<div
								key={index}
								role={stat.clickable ? "button" : undefined}
								tabIndex={stat.clickable ? 0 : undefined}
								className={`rounded-[10px] w-full h-24 lg:h-32 flex flex-col items-center justify-center gap-1 lg:gap-2 transition-all duration-[350ms] ease-in-out ${
									stat.clickable ? "cursor-pointer hover:scale-110" : "cursor-default"
								}`}
								style={{ backgroundColor: `${stat.color}20` }}
								onClick={stat.clickable ? () => handleCardClick(stat) : undefined}
								onKeyDown={stat.clickable ? handleKeyDown : undefined}
							>
								<StatIcon className="w-6 h-6 lg:w-8 lg:h-8" style={{ color: stat.color }} />
								<span className="text-lg lg:text-xl font-semibold" style={{ color: stat.color }}>
									{stat.value}
								</span>
								<span className="text-xs lg:text-sm font-semibold" style={{ color: stat.color }}>
									{t(stat.labelKey)}
								</span>
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
};

export default StatsCards;
