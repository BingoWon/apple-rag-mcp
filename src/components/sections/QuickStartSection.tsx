import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { JevText } from "@/components/ui/jev-brand";
import { SUPPORTED_CLIENTS } from "@/constants/clients";
import { generateCLIInstallPrompt } from "@/utils/agentSetup";
import { copyText } from "@/utils/clipboard";
import { generateInstallPrompt } from "@/utils/mcpConfigService";

export function QuickStartSection() {
	const { t, i18n } = useTranslation();
	const [mode, setMode] = useState<"mcp" | "cli">("mcp");
	const instructions =
		mode === "mcp"
			? generateInstallPrompt({}, i18n.resolvedLanguage)
			: generateCLIInstallPrompt(i18n.resolvedLanguage);
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		try {
			await copyText(instructions);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			toast.error(t("common.copy_failed"));
		}
	};

	return (
		<section className="py-16 sm:py-20" id="quickstart" aria-labelledby="quickstart-title">
			<div className="mx-auto max-w-4xl px-6 lg:px-8">
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
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-4">
							<fieldset
								className="flex min-w-0 rounded-lg bg-secondary p-1"
								aria-label={t("quickstart.connection_label")}
							>
								{(["mcp", "cli"] as const).map((option) => (
									<Button
										key={option}
										variant="ghost"
										aria-pressed={mode === option}
										onClick={() => {
											setMode(option);
											setCopied(false);
										}}
										className="flex-1 px-5 text-muted aria-pressed:bg-card aria-pressed:text-light aria-pressed:shadow-sm sm:flex-none"
									>
										{option.toUpperCase()}
									</Button>
								))}
							</fieldset>
							<Button
								variant="primary"
								onClick={handleCopy}
								aria-label={t(`connect.copy_${mode}`)}
								className="h-12 w-full whitespace-normal px-5 sm:w-auto sm:min-w-56"
							>
								{copied ? (
									<IconCheck className="size-4 shrink-0" aria-hidden="true" />
								) : (
									<IconCopy className="size-4 shrink-0" aria-hidden="true" />
								)}
								<span aria-live="polite">{copied ? t("common.copied") : t("quickstart.copy")}</span>
							</Button>
						</div>
						<p className="mt-4 text-center text-xs leading-6 text-muted">
							{t("quickstart.free_access")} {t("quickstart.shared")}{" "}
							<Link
								to={`/connect#${mode}`}
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
							<p className="text-sm font-semibold text-light">
								Pro <span className="font-normal text-muted">· {t("plans.price_pro")}</span>
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

				<div className="mx-auto mt-6 max-w-2xl">
					<h3 className="mb-3 text-center text-xs font-medium text-muted">
						{t("quickstart.supported_clients")}
					</h3>
					<ul className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
						{SUPPORTED_CLIENTS.map((client) => (
							<li key={client.label} className="min-w-0">
								<a
									href={client.href}
									target="_blank"
									rel="noopener noreferrer"
									className="flex min-h-10 items-center gap-2 rounded-lg px-2 py-2 text-xs text-muted transition-colors hover:bg-secondary hover:text-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:px-3 sm:text-sm"
								>
									<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white">
										<img
											src={client.logo}
											alt=""
											width={16}
											height={16}
											loading="lazy"
											decoding="async"
											className="h-4 w-4 object-contain"
										/>
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
