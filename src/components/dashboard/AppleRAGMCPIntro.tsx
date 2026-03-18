import { IconBook, IconExternalLink, IconSearch, IconBolt, IconRefresh } from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

const features = [
	{ icon: IconSearch, text: "Semantic + keyword + hybrid search", color: "#9595ff" },
	{ icon: IconBook, text: "370k+ docs & 1,300+ WWDC transcripts", color: "#fca147" },
	{ icon: IconBolt, text: "Optimized for speed & low token usage", color: "#42c16e" },
	{ icon: IconRefresh, text: "Continuously updated data sources", color: "#dc5bb7" },
];

export function AppleRAGMCPIntro() {
	return (
		<Card className="mt-6">
			<CardHeader className="pb-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="p-2 rounded-lg bg-brand/10">
							<img src="/logo.svg" alt="Apple RAG MCP" className="h-5 w-5" />
						</div>
						<div>
							<CardTitle className="text-lg">Apple RAG MCP</CardTitle>
							<p className="text-xs text-muted mt-1">
								The Apple docs MCP your AI deserves
							</p>
						</div>
					</div>
					<Button
						size="sm"
						variant="outline"
						onClick={() => window.open("/", "_blank")}
						className="text-sm"
					>
						<IconExternalLink className="h-4 w-4 mr-2" />
						Learn More
					</Button>
				</div>
			</CardHeader>

			<CardContent className="pt-0">
				<div className="space-y-4">
					<p className="text-sm text-muted leading-relaxed">
						Give your AI agents instant access to Apple's entire developer ecosystem.
						Three search modes working together to deliver precise, contextual answers.
					</p>

					<div className="grid grid-cols-2 gap-2">
						{features.map((feature, index) => {
							const Icon = feature.icon;
							return (
								<div
									key={index}
									className="flex items-center gap-2 p-2 rounded-md bg-tertiary/50"
								>
									<Icon
										className="h-4 w-4 flex-shrink-0"
										style={{ color: feature.color }}
									/>
									<span className="text-xs text-muted font-medium">
										{feature.text}
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
