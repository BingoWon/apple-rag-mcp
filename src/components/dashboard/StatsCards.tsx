import { IconCircleCheck, IconDatabase, IconFileText, IconVideo } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { CorpusStats } from "@/types";

const metrics = [
	{
		field: "docs_total",
		label: "stats_doc_pages",
		icon: IconFileText,
		color: "#9595ff",
		url: "https://developer.apple.com/documentation",
	},
	{
		field: "videos_total",
		label: "stats_wwdc_videos",
		icon: IconVideo,
		color: "#fca147",
		url: "https://developer.apple.com/videos/",
	},
	{
		field: "chunks_total",
		label: "stats_chunks",
		icon: IconDatabase,
		color: "#42c16e",
		url: undefined,
	},
	{
		field: "embedded_percentage",
		label: "stats_embedded",
		icon: IconCircleCheck,
		color: "#dc5bb7",
		url: undefined,
	},
] as const;

export default function StatsCards() {
	const { t, i18n } = useTranslation();
	const [data, setData] = useState<CorpusStats | null>();
	useEffect(() => {
		if (data !== undefined) return;
		const controller = new AbortController();
		api
			.getCorpusStats(controller.signal)
			.then(({ success, data }) => {
				if (controller.signal.aborted) return;
				if (
					!success ||
					!data ||
					!Number.isFinite(Date.parse(data.generated_at)) ||
					metrics.some(({ field }) => !Number.isFinite(data[field]))
				)
					throw Error();
				setData(data);
			})
			.catch(() => {
				if (!controller.signal.aborted) setData(null);
			});
		return () => controller.abort();
	}, [data]);
	const locale = i18n.resolvedLanguage;
	return (
		<Card className="mb-6 @container">
			<CardContent className="p-6">
				{data && (
					<div className="flex justify-center mb-5">
						<div className="flex max-w-full items-center gap-2 rounded-full bg-action px-1.5 py-1">
							<div className="w-fit rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-blue-700 sm:text-sm text-center flex items-center gap-1">
								<IconCircleCheck aria-hidden="true" className="w-4 h-4" />
								<span className="hidden sm:inline">{t("common.status")}</span>
							</div>
							<p className="min-w-0 pr-2 text-xs font-semibold text-action-foreground @[450px]:text-base">
								{t("dashboard.stats_freshness")}
							</p>
						</div>
					</div>
				)}
				<div className="mb-5 text-center">
					<h3 className="text-xl font-bold text-light">{t("dashboard.stats_heading")}</h3>
					{data && (
						<p className="mt-1 text-xs text-muted">
							{t("dashboard.stats_date", {
								date: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
									Date.parse(data.generated_at),
								),
							})}
						</p>
					)}
				</div>
				{data ? (
					<div className="grid grid-cols-2 gap-3 @[450px]:grid-cols-4 @[450px]:gap-4">
						{metrics.map(({ field, label, icon: Icon, color, url }) => {
							const Tile = url ? "a" : "div";
							return (
								<Tile
									key={field}
									href={url}
									target={url ? "_blank" : undefined}
									rel={url ? "noopener noreferrer" : undefined}
									className={cn(
										"group flex h-24 min-w-0 flex-col items-center justify-center gap-1 rounded-[10px] text-center focus-visible:outline-2 focus-visible:outline-action @[450px]:h-32 @[450px]:gap-2",
										url &&
											"motion-safe:transition-transform motion-safe:duration-[350ms] motion-safe:hover:scale-110",
									)}
									style={{ backgroundColor: `${color}20` }}
								>
									<Icon aria-hidden="true" className="size-6 lg:size-8" style={{ color }} />
									<strong className="text-lg tabular-nums text-light @[450px]:text-xl">
										{new Intl.NumberFormat(locale).format(data[field])}
										{field === "embedded_percentage" && "%"}
									</strong>
									<span
										className={
											url
												? "text-xs font-medium text-action underline-offset-2 group-hover:underline @[450px]:text-sm"
												: "text-xs font-medium text-light @[450px]:text-sm"
										}
									>
										{t(`dashboard.${label}`)}
									</span>
								</Tile>
							);
						})}
					</div>
				) : data === null ? (
					<div role="alert" className="space-y-3 text-center text-sm text-muted">
						<p>{t("admin.stats_load_error")}</p>
						<Button variant="secondary" size="sm" onClick={() => setData(undefined)}>
							{t("admin.stats_retry")}
						</Button>
					</div>
				) : (
					<p role="status" className="text-center text-sm text-muted">
						{t("admin.stats_loading")}
					</p>
				)}
			</CardContent>
		</Card>
	);
}
