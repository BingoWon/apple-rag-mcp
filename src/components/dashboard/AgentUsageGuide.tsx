import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AgentSetupCard } from "@/components/agent/AgentSetupCard";
import { MCPUsageGuide } from "@/components/dashboard/MCPUsageGuide";
import { Button } from "@/components/ui/Button";
export function AgentUsageGuide() {
	const { t } = useTranslation();
	const [mode, setMode] = useState<"mcp" | "cli">("mcp");
	return (
		<section className="space-y-4" aria-label={t("nav.connect")}>
			<div className="flex gap-2">
				{(["mcp", "cli"] as const).map((value) => (
					<Button
						key={value}
						aria-pressed={mode === value}
						variant={mode === value ? "primary" : "outline"}
						className="flex-1"
						onClick={() => setMode(value)}
					>
						{value.toUpperCase()}
					</Button>
				))}
			</div>
			<p className="text-xs leading-6 text-muted">{t("quickstart.shared")}</p>
			{mode === "mcp" ? <MCPUsageGuide /> : <AgentSetupCard mode="cli" />}
		</section>
	);
}
