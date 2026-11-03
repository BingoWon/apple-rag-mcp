import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { AUTH_STYLES } from "../../../shared/auth-presentation";

export function AuthShell({ children }: { children: ReactNode }) {
	const { t } = useTranslation();
	return (
		<main className="auth-page">
			<style>{AUTH_STYLES}</style>
			<header className="auth-top">
				<Link to="/" className="auth-brand">
					<span className="auth-brand-mark" aria-hidden="true">
						<svg
							aria-hidden="true"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.8"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<path d="m5 7 5 5-5 5M13 17h6" />
						</svg>
					</span>
					Apple RAG
				</Link>
				<div className="auth-controls">
					<LanguageSwitcher />
					<ThemeToggle />
				</div>
			</header>
			<div className="auth-center">
				<section className="auth-card">{children}</section>
			</div>
			<footer className="auth-footer">
				<span>Apple RAG</span>
				<Link to="/privacy-policy">{t("cli.privacy")}</Link>
				<Link to="/terms-of-service">{t("cli.terms")}</Link>
			</footer>
		</main>
	);
}
