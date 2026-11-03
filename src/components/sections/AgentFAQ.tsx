import { useTranslation } from "react-i18next";
export function AgentFAQ() {
	const { t } = useTranslation();
	return (
		<section className="mx-auto max-w-3xl px-6 py-20" id="faq">
			<h2 className="mb-8 text-3xl font-semibold tracking-tight text-foreground">
				{t("connect.faq_title")}
			</h2>
			<div className="divide-y divide-border">
				{["choice", "plan", "key", "sources", "control"].map((key) => (
					<details key={key} className="group py-5">
						<summary className="cursor-pointer text-base font-medium text-foreground focus-visible:outline-brand">
							{t(`connect.faq_${key}_q`)}
						</summary>
						<p className="mt-4 text-sm leading-7 text-muted">{t(`connect.faq_${key}_a`)}</p>
					</details>
				))}
			</div>
		</section>
	);
}
