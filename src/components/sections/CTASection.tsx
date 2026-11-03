import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { JevText } from "@/components/ui/jev-brand";
export function CTASection() {
	const { t } = useTranslation();
	return (
		<section id="cta" className="border-t border-default px-6 py-24 text-center">
			<h2 className="mx-auto max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
				{t("cta.title")}
			</h2>
			<p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted">
				<JevText i18nKey="cta.subtitle" />
			</p>
			<Button asChild variant="primary" size="lg" className="mt-8">
				<Link to="/connect">{t("hero.cta")}</Link>
			</Button>
		</section>
	);
}
