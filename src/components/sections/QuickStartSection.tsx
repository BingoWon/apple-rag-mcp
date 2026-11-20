import { IconCopy } from "@tabler/icons-react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { JevText } from "@/components/ui/jev-brand";
import { supportedClients } from "@/constants/mcpClients";
import { generateCLIInstallPrompt } from "@/utils/agentSetup";
import { copyText } from "@/utils/clipboard";
import { generateInstallPrompt } from "@/utils/mcpConfigService";

export function QuickStartSection() {
	const { t, i18n } = useTranslation();
	const handleCopy = async (mode: "mcp" | "cli") => {
		try {
			await copyText(
				mode === "mcp"
					? generateInstallPrompt({}, i18n.resolvedLanguage)
					: generateCLIInstallPrompt(i18n.resolvedLanguage),
			);
			toast.success(t("guide.install_prompt_copied"));
		} catch {
			toast.error(t("common.copy_failed"));
		}
	};

	return (
		<section className="py-16 sm:py-20" id="quickstart" aria-labelledby="quickstart-title">
			<div className="mx-auto max-w-7xl px-6 lg:px-8">
				<header className="mx-auto mb-8 max-w-2xl text-center">
					<p className="text-sm font-semibold text-brand">{t("quickstart.eyebrow")}</p>
					<h2
						id="quickstart-title"
						className="mt-3 text-balance text-3xl font-bold tracking-tight text-light sm:text-4xl"
					>
						{t("quickstart.title")}
					</h2>
					<p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted">
						<JevText i18nKey="quickstart.subtitle" />
					</p>
				</header>

				<Card className="mx-auto max-w-2xl rounded-2xl shadow-none">
					<CardContent className="p-5 sm:p-6">
						<div className="grid gap-3 sm:grid-cols-2">
							{(["mcp", "cli"] as const).map((mode) => (
								<Button
									key={mode}
									variant={mode === "mcp" ? "primary" : "outline"}
									onClick={() => handleCopy(mode)}
									className="h-auto min-h-12 w-full whitespace-normal px-4 py-3"
								>
									<IconCopy className="size-4 shrink-0" aria-hidden="true" />
									{t(`connect.copy_${mode}`)}
								</Button>
							))}
						</div>
						<p className="mt-4 text-center text-xs leading-6 text-muted">
							{t("quickstart.free_access")} {t("quickstart.shared")}{" "}
							<Link
								to="/connect"
								className="whitespace-nowrap font-medium text-brand hover:underline"
							>
								{t("connect.details")} →
							</Link>
						</p>
					</CardContent>

					<a
						href="#pricing"
						className="group flex flex-col items-start gap-3 border-t border-default bg-secondary/30 p-5 transition-colors hover:bg-secondary/70 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4"
					>
						<div>
							<p className="flex flex-wrap items-baseline gap-2 text-sm font-semibold text-light">
								Pro <span aria-hidden="true">·</span>
								<strong className="text-xl font-bold text-brand">{t("plans.price_pro")}</strong>
							</p>
							<p className="mt-1 text-xs leading-5 text-muted">
								{t("quickstart.pro_weekly_calls")} <span aria-hidden="true">·</span>{" "}
								{t("quickstart.pro_minute_calls")}
							</p>
						</div>
						<span className="whitespace-nowrap text-sm font-medium text-brand group-hover:underline">
							{t("quickstart.pro_cta")} →
						</span>
					</a>
				</Card>

				<div className="mt-10 text-center">
					<h3 className="text-sm font-semibold text-light mb-2">
						{t("quickstart.supported_clients")}
					</h3>
					<ul className="flex flex-wrap justify-center gap-x-5 gap-y-3">
						{supportedClients(i18n.resolvedLanguage).map((client) => (
							<li key={client.label}>
								<a
									href={client.href}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center gap-2 rounded-sm text-sm text-muted transition-colors hover:text-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
								>
									<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white">
										<client.Logo aria-hidden="true" className="size-4 text-neutral-900" />
									</span>
									<span className="whitespace-nowrap">{client.label}</span>
								</a>
							</li>
						))}
					</ul>
				</div>
			</div>
		</section>
	);
}
