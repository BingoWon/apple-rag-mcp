import type { Icon } from "@tabler/icons-react";
import { IconCircleCheck, IconDatabase, IconFileText, IconVideo } from "@tabler/icons-react";
import { Card, CardContent } from "@/components/ui/Card";

interface StatCard {
	icon: Icon;
	value: string;
	label: string;
	color: string;
	clickable: boolean;
	url?: string;
}

const StatsCards = () => {
	const stats: StatCard[] = [
		{
			icon: IconFileText,
			value: "373,047",
			label: "Apple Doc Pages",
			color: "#9595ff",
			clickable: true,
			url: "https://developer.apple.com/documentation",
		},
		{
			icon: IconVideo,
			value: "1,409",
			label: "WWDC Videos",
			color: "#fca147",
			clickable: true,
			url: "https://developer.apple.com/videos/",
		},
		{
			icon: IconDatabase,
			value: "396,516",
			label: "Chunks",
			color: "#42c16e",
			clickable: false,
		},
		{
			icon: IconCircleCheck,
			value: "100%",
			label: "Embedded",
			color: "#dc5bb7",
			clickable: false,
		},
	];

	const handleCardClick = (stat: StatCard) => {
		if (stat.clickable && stat.url) {
			window.open(stat.url, "_blank");
		}
	};

	// Calculate yesterday's date based on user's system time
	const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});

	return (
		<Card className="mb-6">
			<CardContent className="p-6">
				<div className="flex justify-center mb-5">
					<div className="flex w-auto items-center space-x-2 rounded-full bg-brand px-1.5 py-1 whitespace-pre">
						<div className="w-fit rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-brand sm:text-sm text-center flex items-center gap-1">
							<IconCircleCheck className="w-4 h-4" />
							<span className="hidden sm:inline">Status</span>
						</div>
						<p className="text-xs font-semibold text-white sm:text-base pr-2">
							Data automatically updated daily to ensure freshness!
						</p>
					</div>
				</div>
				<div className="text-center mb-5">
					<h3 className="text-xl font-bold text-light mb-2">
						Our most comprehensive Apple knowledge base for AI agents
					</h3>
					<p className="text-muted text-sm opacity-75">Data as of {yesterdayDate}</p>
				</div>
				<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
					{stats.map((stat, index) => {
						const Icon = stat.icon;
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
								<Icon className="w-6 h-6 lg:w-8 lg:h-8" style={{ color: stat.color }} />
								<span className="text-lg lg:text-xl font-semibold" style={{ color: stat.color }}>
									{stat.value}
								</span>
								<span className="text-xs lg:text-sm font-semibold" style={{ color: stat.color }}>
									{stat.label}
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
