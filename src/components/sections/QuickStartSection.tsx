import { IconCalendar, IconCheck, IconCopy, IconGauge, IconRocket } from "@tabler/icons-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
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
					<div className="rounded-xl overflow-hidden shadow-2xl border border-black/10 dark:border-white/10 bg-[#1e1e1e]">
						{/* Title Bar */}
						<div className="flex items-center justify-between px-4 py-3 bg-[#2d2d2d] border-b border-white/5">
							<div className="flex items-center gap-2">
								<span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
								<span className="w-3 h-3 rounded-full bg-[#febc2e]" />
								<span className="w-3 h-3 rounded-full bg-[#28c840]" />
							</div>
							<span className="text-xs text-[#8b8b8b] font-medium select-none">
								{mode.toUpperCase()} · agent-setup.txt
							</span>
							<button
								type="button"
								onClick={handleCopy}
								aria-label={t(`connect.copy_${mode}`)}
								className="flex items-center gap-1.5 text-xs text-[#8b8b8b] hover:text-white transition-colors duration-200 px-2 py-1 rounded-md hover:bg-white/10"
							>
								{copied ? (
									<>
										<IconCheck className="w-3.5 h-3.5 text-[#28c840]" />
										<span className="text-[#28c840]">{t("common.copied")}</span>
									</>
								) : (
									<>
										<IconCopy className="w-3.5 h-3.5" />
										<span>{t("common.copy")}</span>
									</>
								)}
							</button>
						</div>

						{/* Code Area */}
						<div className="p-5 overflow-x-auto max-h-80 overflow-y-auto">
							<pre className="whitespace-pre-wrap break-words text-sm leading-relaxed font-mono text-[#d4d4d4]">
								<code>{instructions}</code>
							</pre>
						</div>
					</div>
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
