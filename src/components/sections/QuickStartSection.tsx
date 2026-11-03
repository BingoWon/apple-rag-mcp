import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AgentSetupCard } from "@/components/agent/AgentSetupCard";
import { SUPPORTED_CLIENTS } from "@/constants/clients";

export function QuickStartSection() {
	const { t } = useTranslation();
	return (
		<section className="scroll-mt-24 py-20 sm:py-28" id="quickstart">
			<div className="mx-auto max-w-5xl px-6">
				<div className="mx-auto mb-10 max-w-3xl text-center">
					<p className="text-sm font-semibold text-brand">{t("quickstart.eyebrow")}</p>
					<h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
						{t("quickstart.title")}
					</h2>
					<p className="mt-5 text-base leading-7 text-muted">{t("quickstart.subtitle")}</p>
				</div>
				<div className="grid gap-5 md:grid-cols-2">
					<AgentSetupCard mode="mcp" />
					<AgentSetupCard mode="cli" />
				</div>
				<div className="mt-6 space-y-2 text-center text-sm text-muted">
					<p>{t("quickstart.shared")}</p>
					<p>
						{t("quickstart.free_access")}{" "}
						<Link to="/#pricing" className="text-brand hover:underline">
							{t("quickstart.pro_cta")} →
						</Link>
					</p>
				</div>
				<div className="mt-10 text-center">
					<p className="mb-4 text-xs font-medium text-muted">{t("quickstart.supported_clients")}</p>
					<ul className="flex flex-wrap justify-center gap-x-5 gap-y-3">
						{SUPPORTED_CLIENTS.map((client) => (
							<li key={client.label}>
								<a
									href={client.href}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground"
								>
									<img
										src={client.logo}
										alt=""
										width={18}
										height={18}
										loading="lazy"
										className="rounded-sm bg-white"
									/>
									{client.label}
								</a>
							</li>
						))}
					</ul>
				</div>
			</div>
		</section>
	);
}
