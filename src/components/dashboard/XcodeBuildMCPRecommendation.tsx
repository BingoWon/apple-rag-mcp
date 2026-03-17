import {
	IconBrandApple,
	IconBrandGithub,
	IconCode,
	IconDeviceMobile,
	IconRocket,
	IconStar,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export function XcodeBuildMCPRecommendation() {
	const features = [
		{
			icon: IconBrandApple,
			text: "Full Xcode operations",
			color: "#42c16e",
		},
		{
			icon: IconDeviceMobile,
			text: "All Apple platforms",
			color: "#9595ff",
		},
		{
			icon: IconCode,
			text: "Project & package mgmt",
			color: "#fca147",
		},
		{
			icon: IconRocket,
			text: "AI agent automation",
			color: "#dc5bb7",
		},
	];

	const handleGitHubClick = () => {
		window.open("https://github.com/cameroncooke/XcodeBuildMCP", "_blank");
	};

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
							<p className="text-xs text-muted mt-1">Recommended third-party MCP</p>
						</div>
					</div>
					<Button size="sm" variant="outline" onClick={handleGitHubClick} className="text-sm">
						<IconBrandGithub className="h-4 w-4 mr-2" />
						Explore on GitHub
					</Button>
				</div>
			</CardHeader>

			<CardContent className="pt-0">
				<div className="space-y-4">
					{/* Project Info */}
					<div>
						<p className="text-sm text-muted leading-relaxed">
							Bridges AI agents with complete Xcode operations. Enables autonomous building,
							testing, and deployment - everything Xcode can do, AI agents can now do.
						</p>
					</div>

					{/* Features Grid */}
					<div className="grid grid-cols-2 gap-2">
						{features.map((feature, index) => {
							const Icon = feature.icon;
							return (
								<div key={index} className="flex items-center gap-2 p-2 rounded-md bg-tertiary/50">
									<Icon className="h-4 w-4 flex-shrink-0" style={{ color: feature.color }} />
									<span className="text-xs text-muted font-medium">{feature.text}</span>
								</div>
							);
						})}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
