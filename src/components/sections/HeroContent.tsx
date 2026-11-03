import type React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { JevText } from "@/components/ui/jev-brand";

export const HeroContent: React.FC = () => {
	const { t } = useTranslation();
	return (
		<div
			className="relative mb-0 px-4 text-center text-3xl font-bold text-light md:mb-36 md:px-0"
			id="hero"
		>
			<div className="text-center md:mb-20">
				<p className="mb-5 text-sm font-medium tracking-wide text-brand">MCP / CLI</p>
				<h1 className="mx-auto mb-6 max-w-5xl text-4xl font-semibold leading-tight tracking-tight text-foreground md:text-6xl">
					<span className="text-brand">{t("hero.title_apple")}</span>
					<br />
					{t("hero.title_agent")}
				</h1>
				<p className="mx-auto max-w-2xl text-base leading-7 text-muted md:text-lg">
					{t("hero.description")}
				</p>
				<p className="mt-4 text-base font-medium text-foreground">{t("hero.connection")}</p>
				<div className="mt-8 flex flex-wrap items-center justify-center gap-4">
					<Button asChild variant="primary" size="lg">
						<Link to="/connect">{t("hero.cta")}</Link>
					</Button>
					<Button asChild variant="outline" size="lg">
						<a href="#quickstart">{t("hero.secondary")}</a>
					</Button>
				</div>
				<p className="mt-5 text-xs font-normal text-muted">{t("hero.account")}</p>
				<p className="mt-3 text-xs font-normal text-muted">
					<JevText i18nKey="hero.ranking" />
				</p>
			</div>
			<div className="hero-stickers">
				<a
					href="https://typesafe.ai/"
					target="_blank"
					rel="noopener noreferrer"
					title={t("hero.model_team")}
					className="hero-sticker hero-sticker-ceo"
				>
					<img
						src="/typesafe-ceo.webp"
						alt={t("hero.model_team")}
						width={512}
						height={499}
						decoding="async"
					/>
				</a>
				<a
					href="https://typesafe.ai/"
					target="_blank"
					rel="noopener noreferrer"
					title={t("hero.model_logo")}
					className="hero-sticker hero-sticker-logo"
				>
					<img
						src="/typesafe-logo.webp"
						alt={t("hero.model_logo")}
						width={400}
						height={400}
						decoding="async"
					/>
				</a>
			</div>
		</div>
	);
};
