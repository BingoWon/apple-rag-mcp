import { IconCalendar, IconCheck, IconCopy, IconGauge, IconRocket } from "@tabler/icons-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
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
		<div className="relative py-24 sm:py-32" id="quickstart">
			<div className="mx-auto max-w-7xl px-6 lg:px-8">
				<div className="mx-auto max-w-4xl lg:text-center mb-12">
					<h2 className="text-base font-semibold leading-7 text-brand">
						{t("quickstart.eyebrow")}
					</h2>
					<p className="mt-2 text-3xl font-bold tracking-tight text-light sm:text-4xl">
						{t("quickstart.title")}
					</p>
					<p className="mt-6 text-lg leading-8 text-muted">
						<JevText i18nKey="quickstart.subtitle" />
					</p>
				</div>

				<div className="mx-auto max-w-2xl">
					<fieldset
						className="mb-4 flex justify-center gap-3"
						aria-label={t("quickstart.connection_label")}
					>
						{(["mcp", "cli"] as const).map((option) => (
							<button
								type="button"
								key={option}
								aria-pressed={mode === option}
								onClick={() => {
									setMode(option);
									setCopied(false);
								}}
								className="rounded-lg border border-default px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-light aria-pressed:border-brand aria-pressed:text-brand"
							>
								{option.toUpperCase()}
							</button>
						))}
					</fieldset>
					<Button
						variant="primary"
						onClick={handleCopy}
						aria-label={t(`connect.copy_${mode}`)}
						className="mx-auto flex h-auto min-h-12 w-fit max-w-full whitespace-normal px-6 py-3"
					>
						{copied ? (
							<IconCheck className="size-4 shrink-0" aria-hidden="true" />
						) : (
							<IconCopy className="size-4 shrink-0" aria-hidden="true" />
						)}
						{copied ? t("common.copied") : t(`connect.copy_${mode}`)}
					</Button>
					<p className="mt-4 text-center text-sm text-muted">{t("quickstart.free_access")}</p>
					<p className="mt-2 text-center text-sm text-muted">{t("quickstart.shared")}</p>
					<p className="mt-3 text-center text-sm">
						<Link to={`/connect#${mode}`} className="text-brand hover:underline">
							{t("connect.details")} →
						</Link>
					</p>
				</div>

				{/* Pro Upgrade Banner */}
				<div className="mx-auto max-w-2xl mt-6">
					<a
						href="#pricing"
						className="group block rounded-xl border border-brand/20 bg-brand/5 hover:bg-brand/10 transition-colors duration-200 px-5 py-4"
					>
						<div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 justify-between">
							<div className="flex flex-wrap items-center gap-2 text-sm">
								<span className="inline-flex items-center gap-1 text-brand font-semibold">
									<IconRocket className="w-4 h-4" />
									Pro · {t("plans.price_pro")}
								</span>
								<span className="inline-flex items-center gap-1 text-muted">
									<IconCalendar className="w-3.5 h-3.5 text-brand/70" />
									{t("quickstart.pro_weekly_calls")}
								</span>
								<span className="text-muted/40">·</span>
								<span className="inline-flex items-center gap-1 text-muted">
									<IconGauge className="w-3.5 h-3.5 text-brand/70" />
									{t("quickstart.pro_minute_calls")}
								</span>
							</div>
							<span className="text-sm font-medium text-brand group-hover:underline whitespace-nowrap">
								{t("quickstart.pro_cta")} →
							</span>
						</div>
					</a>
				</div>

				<div className="mt-10 text-center">
					<h3 className="text-sm font-semibold text-light mb-2">
						{t("quickstart.supported_clients")}
					</h3>
					<ul className="flex flex-wrap justify-center gap-x-5 gap-y-3">
						{SUPPORTED_CLIENTS.map((client) => (
							<li key={client.label}>
								<a
									href={client.href}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center gap-2 rounded-sm text-sm text-muted transition-colors hover:text-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
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
		</div>
	);
}
