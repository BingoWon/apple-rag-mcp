import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import i18n from "@/i18n";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export { formatDate, formatDateOnly, formatDateTimeWithZone } from "./datetime";

export function formatCurrency(amount: number, currency: string | null, locale?: string): string {
	const resolvedLocale = locale || i18n.resolvedLanguage || i18n.language || "en";
	if (!Number.isFinite(amount)) return "—";
	if (!currency) return new Intl.NumberFormat(resolvedLocale).format(amount);
	const code = currency.trim().toUpperCase();
	try {
		return new Intl.NumberFormat(resolvedLocale, {
			style: "currency",
			currency: code,
		}).format(amount);
	} catch {
		return `${new Intl.NumberFormat(resolvedLocale).format(amount)} ${code}`;
	}
}
