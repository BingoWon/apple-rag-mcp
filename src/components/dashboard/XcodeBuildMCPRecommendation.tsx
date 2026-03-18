import {
	IconBrandApple,
	IconBrandGithub,
	IconCode,
	IconDeviceMobile,
	IconRocket,
	IconStar,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

const FEATURES = [
	{ icon: IconBrandApple, key: "xcode_feat_xcode", color: "#42c16e" },
	{ icon: IconDeviceMobile, key: "xcode_feat_platforms", color: "#9595ff" },
	{ icon: IconCode, key: "xcode_feat_project", color: "#fca147" },
	{ icon: IconRocket, key: "xcode_feat_ai", color: "#dc5bb7" },
] as const;

export function XcodeBuildMCPRecommendation() {
	const { t } = useTranslation();

	return (
		<Card className="mt-6">
			<CardHeader className="pb-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="p-2 rounded-lg bg-brand/10">
							<IconStar className="h-5 w-5 text-brand" />
						</div>
						<div>
							<CardTitle className="text-lg">XcodeBuildMCP</CardTitle>
							<p className="text-xs text-muted mt-1">{t("dashboard.xcode_subtitle")}</p>
						</div>
					</div>
					<Button
						size="sm"
						variant="outline"
						onClick={() => window.open("https://github.com/cameroncooke/XcodeBuildMCP", "_blank")}
						className="text-sm"
					>
						<IconBrandGithub className="h-4 w-4 mr-2" />
						{t("dashboard.xcode_explore")}
					</Button>
				</div>
			</CardHeader>

			<CardContent className="pt-0">
				<div className="space-y-4">
					<p className="text-sm text-muted leading-relaxed">
						{t("dashboard.xcode_desc")}
					</p>

					<div className="grid grid-cols-2 gap-2">
						{FEATURES.map((feature, index) => {
							const Icon = feature.icon;
							return (
								<div key={index} className="flex items-center gap-2 p-2 rounded-md bg-tertiary/50">
									<Icon className="h-4 w-4 flex-shrink-0" style={{ color: feature.color }} />
									<span className="text-xs text-muted font-medium">
										{t(`dashboard.${feature.key}`)}
									</span>
								</div>
							);
						})}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
