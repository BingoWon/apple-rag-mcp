import {
	IconArrowRight,
	IconClipboard,
	IconPlugConnected,
	IconTerminal2,
} from "@tabler/icons-react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { generateCLIInstallPrompt } from "@/utils/agentSetup";
import { copyText } from "@/utils/clipboard";
import { generateInstallPrompt } from "@/utils/mcpConfigService";

export function AgentSetupCard({ mode }: { mode: "mcp" | "cli" }) {
	const { t, i18n } = useTranslation();
	const Icon = mode === "mcp" ? IconPlugConnected : IconTerminal2;
	return (
		<Card className="flex h-full min-w-0 flex-col rounded-2xl shadow-none">
			<CardHeader>
				<Icon size={24} className="mb-3 text-brand" aria-hidden="true" />
				<CardTitle className="text-2xl">{t(`connect.${mode}_title`)}</CardTitle>
				<CardDescription className="leading-relaxed">
					{t(`connect.${mode}_description`)}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col items-start gap-5">
				<p className="text-sm leading-relaxed text-muted">{t("connect.paste")}</p>
				<Button
					variant={mode === "mcp" ? "primary" : "outline"}
					className="mt-auto h-auto min-h-11 w-full whitespace-normal py-3"
					onClick={async () => {
						try {
							await copyText(
								mode === "mcp"
									? generateInstallPrompt({}, i18n.resolvedLanguage)
									: generateCLIInstallPrompt(i18n.resolvedLanguage),
							);
							toast.success(t("common.copied"));
						} catch {
							toast.error(t("common.copy_failed"));
						}
					}}
				>
					<IconClipboard size={16} className="shrink-0" aria-hidden="true" />
					{t(`connect.copy_${mode}`)}
				</Button>
				<Link
					to={`/connect#${mode}`}
					className="inline-flex items-center gap-2 text-sm text-brand hover:underline"
				>
					{t("connect.details")}
					<IconArrowRight size={15} aria-hidden="true" />
				</Link>
			</CardContent>
		</Card>
	);
}
