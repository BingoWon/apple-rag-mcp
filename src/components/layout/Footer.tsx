import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Brand } from "@/components/layout/Brand";
import { JevText } from "@/components/ui/jev-brand";
import { activateFabContact } from "@/utils/contact";

export function Footer() {
	const { t } = useTranslation();

	const navigation = {
		product: [
			{ name: t("nav.features"), href: "/#features" },
			{ name: t("nav.mcp_guide"), href: "/connect#mcp" },
			{ name: t("nav.cli_guide"), href: "/connect#cli" },
			{ name: t("nav.pricing"), href: "/#pricing" },
			{ name: t("nav.contact"), href: "#", action: "contact" },
		],
		dashboard: [
			{ name: t("nav.overview"), href: "/overview/" },
			{ name: t("nav.mcp_tokens"), href: "/mcp-tokens/" },
			{ name: t("nav.authorized_ips"), href: "/authorized-ips/" },
			{ name: t("nav.billing"), href: "/billing/" },
			{ name: t("nav.usage"), href: "/usage/" },
		],
	};

	return (
		<footer className="bg-background border-t border-border">
			<div className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
				<div className="xl:grid xl:grid-cols-3 xl:gap-16">
					<div className="space-y-8">
						<div className="flex items-center">
							<Brand />
						</div>
						<p className="text-sm leading-6 text-muted">
							<JevText i18nKey="footer.tagline" />
						</p>
					</div>
					<div className="mt-16 grid grid-cols-2 gap-8 xl:col-span-2 xl:mt-0">
						<div>
							<h3 className="text-sm font-semibold leading-6 text-light">{t("nav.product")}</h3>
							<ul className="mt-6 space-y-4">
								{navigation.product.map((item) => (
									<li key={item.name}>
										{item.action === "contact" ? (
											<button
												type="button"
												onClick={(e) => {
													e.preventDefault();
													activateFabContact();
												}}
												className="text-sm leading-6 text-muted hover:text-light cursor-pointer"
											>
												{item.name}
											</button>
										) : (
											<Link
												to={item.href}
												className="text-sm leading-6 text-muted hover:text-light"
											>
												{item.name}
											</Link>
										)}
									</li>
								))}
							</ul>
						</div>
						<div>
							<h3 className="text-sm font-semibold leading-6 text-light">
								{t("common.dashboard")}
							</h3>
							<ul className="mt-6 space-y-4">
								{navigation.dashboard.map((item) => (
									<li key={item.name}>
										<Link to={item.href} className="text-sm leading-6 text-muted hover:text-light">
											{item.name}
										</Link>
									</li>
								))}
							</ul>
						</div>
					</div>
				</div>
				<div className="mt-16 border-t border-default pt-4 space-y-4">
					<p className="text-xs leading-5 text-muted text-center md:text-left">
						{t("footer.copyright")}
					</p>
					<div className="flex flex-col items-center space-y-4 md:flex-row md:justify-between md:space-y-0">
						<div className="flex space-x-4 text-xs">
							<Link to="/privacy-policy" className="text-muted hover:text-light">
								{t("footer.privacy")}
							</Link>
							<Link to="/terms-of-service" className="text-muted hover:text-light">
								{t("footer.terms")}
							</Link>
						</div>
						<p className="text-xs text-muted">{t("footer.crafted")}</p>
					</div>
				</div>
			</div>
		</footer>
	);
}
