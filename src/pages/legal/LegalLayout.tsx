import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Outlet } from "react-router-dom";
import { ShootingStars } from "@/components/effects/shooting-stars";
import { StarsBackground } from "@/components/effects/stars-background";
import { Brand } from "@/components/layout/Brand";
import LegalTabs from "@/components/legal/LegalTabs";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function LegalLayout() {
	const { t } = useTranslation();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return (
			<div className="min-h-dvh bg-background relative">
				<div className="fixed inset-0 z-0">
					<ShootingStars />
					<StarsBackground />
				</div>
				<div className="relative z-10">
					<nav className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
						<div className="max-w-5xl mx-auto px-4 py-4">
							<div className="flex items-center justify-between">
								<Link to="/" className="flex items-center">
									<Brand />
								</Link>
								<div className="animate-pulse w-10 h-10 bg-surface rounded-lg" />
							</div>
						</div>
					</nav>
					<div className="container mx-auto px-4 py-8">
						<div className="max-w-5xl mx-auto">
							<div className="flex justify-center">
								<div className="animate-pulse text-muted">{t("common.loading")}</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-dvh bg-background relative">
			<div className="fixed inset-0 z-0">
				<ShootingStars />
				<StarsBackground />
			</div>
			<div className="relative z-10">
				<nav className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
					<div className="max-w-5xl mx-auto px-4 py-4">
						<div className="flex items-center justify-between">
							<Link to="/" className="flex items-center hover:opacity-80 transition-opacity">
								<Brand />
							</Link>
							<div className="flex items-center gap-2">
								<LanguageSwitcher />
								<ThemeToggle variant="icon" />
							</div>
						</div>
					</div>
				</nav>
				<div className="container mx-auto px-4 py-8">
					<div className="max-w-5xl mx-auto">
						<LegalTabs />
					</div>
				</div>
			</div>
			<Outlet />
		</div>
	);
}
