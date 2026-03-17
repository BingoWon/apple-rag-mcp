import { IconLanguage } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const LANGUAGES = [
	{ code: "en", label: "EN" },
	{ code: "zh", label: "中" },
] as const;

export function LanguageSwitcher({ className }: { className?: string }) {
	const { i18n } = useTranslation();

	return (
		<div className={cn("flex items-center gap-1", className)}>
			<IconLanguage className="h-4 w-4 text-muted shrink-0" />
			{LANGUAGES.map((lang) => (
				<Button
					key={lang.code}
					size="sm"
					variant={i18n.language === lang.code ? "default" : "ghost"}
					onClick={() => i18n.changeLanguage(lang.code)}
					className="h-6 px-1.5 text-xs min-w-0"
				>
					{lang.label}
				</Button>
			))}
		</div>
	);
}
