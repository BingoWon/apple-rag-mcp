import { IconBrain, IconCopy, IconCheck } from "@tabler/icons-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

const SKILL_PATHS = [
	{ platform: "Cursor", path: "~/.cursor/skills/apple-dev-docs/" },
	{ platform: "Codex", path: "~/.codex/skills/apple-dev-docs/" },
] as const;

export function AppleRAGMCPIntro() {
	const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

	const handleCopy = (path: string, idx: number) => {
		navigator.clipboard.writeText(path);
		setCopiedIdx(idx);
		setTimeout(() => setCopiedIdx(null), 2000);
	};

	return (
		<Card className="mt-6">
			<CardHeader className="pb-4">
				<div className="flex items-center gap-3">
					<div className="p-2 rounded-lg bg-brand/10">
						<IconBrain className="h-5 w-5 text-brand" />
					</div>
					<div>
						<CardTitle className="text-lg">Agent Skill</CardTitle>
						<p className="text-xs text-muted mt-1">Teach your AI agent to use Apple RAG MCP</p>
					</div>
				</div>
			</CardHeader>

			<CardContent className="pt-0">
				<p className="text-sm text-muted leading-relaxed mb-4">
					Copy <code className="text-xs bg-tertiary/80 px-1.5 py-0.5 rounded font-mono text-light">skills/apple-dev-docs/</code> to your agent's skill location:
				</p>

				<div className="space-y-2">
					{SKILL_PATHS.map((item, idx) => (
						<div
							key={idx}
							className="flex items-center justify-between p-2.5 rounded-md bg-tertiary/50 group"
						>
							<div className="flex items-center gap-3 min-w-0">
								<span className="text-xs font-semibold text-light w-14 shrink-0">
									{item.platform}
								</span>
								<code className="text-xs font-mono text-muted truncate">
									{item.path}
								</code>
							</div>
							<button
								type="button"
								onClick={() => handleCopy(item.path, idx)}
								className="ml-2 p-1 rounded text-muted hover:text-light hover:bg-tertiary transition-colors shrink-0"
							>
								{copiedIdx === idx ? (
									<IconCheck className="h-3.5 w-3.5 text-green-500" />
								) : (
									<IconCopy className="h-3.5 w-3.5" />
								)}
							</button>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
