import i18n from "@/i18n";
import { parseUTCDate } from "../../shared/datetime";
import {
	DateTimeError,
	type ParsedDateTime,
	TIME_PRECISION_CONFIG,
	type TimeKeyOptions,
} from "./types/datetime";

export function parseDateTime(input: string | Date | number): ParsedDateTime {
	if (!input) {
		return {
			date: new Date(),
			isValid: false,
			hasTimezone: false,
			originalInput: String(input),
			error: "Empty input",
		};
	}

	try {
		let date: Date;
		let hasTimezone = false;

		if (input instanceof Date) {
			date = input;
			hasTimezone = true;
		} else if (typeof input === "number") {
			date = new Date(input);
			hasTimezone = true;
		} else {
			const dateString = String(input).trim();
			date = new Date(dateString);
			hasTimezone = /[TZ]|[+-]\d{2}:?\d{2}$/.test(dateString);
		}

		const isValid = !Number.isNaN(date.getTime());

		return {
			date,
			isValid,
			hasTimezone,
			originalInput: String(input),
			error: isValid ? undefined : "Invalid date",
		};
	} catch (error) {
		return {
			date: new Date(),
			isValid: false,
			hasTimezone: false,
			originalInput: String(input),
			error: error instanceof Error ? error.message : "Parse error",
		};
	}
}

export function createTimeKey(date: Date | string | number, options: TimeKeyOptions): string {
	const parsed = parseDateTime(date);

	if (!parsed.isValid) {
		throw new DateTimeError(
			`Invalid date for time key generation: ${parsed.error}`,
			date,
			"createTimeKey",
		);
	}

	const { precision, useLocalTime = true } = options;
	const config = TIME_PRECISION_CONFIG[precision];

	const targetDate = useLocalTime ? parsed.date : new Date(parsed.date.toISOString());
	const truncatedDate = config.truncate(targetDate);

	const year = truncatedDate.getFullYear();
	const month = String(truncatedDate.getMonth() + 1).padStart(2, "0");
	const day = String(truncatedDate.getDate()).padStart(2, "0");
	const hour = String(truncatedDate.getHours()).padStart(2, "0");
	const minute = String(truncatedDate.getMinutes()).padStart(2, "0");

	switch (precision) {
		case "minute":
			return `${year}-${month}-${day}T${hour}:${minute}:00`;
		case "hour":
			return `${year}-${month}-${day}T${hour}:00:00`;
		case "day":
			return `${year}-${month}-${day}T00:00:00`;
		case "month":
			return `${year}-${month}-01T00:00:00`;
		case "year":
			return `${year}-01-01T00:00:00`;
		default:
			throw new DateTimeError(`Unsupported precision: ${precision}`, date, "createTimeKey");
	}
}

const toDate = parseUTCDate;

function activeLocale(locale?: string): string {
	return locale || i18n.resolvedLanguage || i18n.language || "en";
}

export function formatDate(input: string | Date | number, locale?: string): string {
	const date = toDate(input);
	if (!date) return "—";

	const lang = activeLocale(locale);

	if (lang.startsWith("zh")) {
		const y = date.getFullYear();
		const m = date.getMonth() + 1;
		const d = date.getDate();
		const timePart = date.toLocaleTimeString("zh-CN", {
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
			hour12: false,
		});
		return `${y}年${m}月${d}日 ${timePart}`;
	}

	const datePart = date.toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
	const timePart = date.toLocaleTimeString("en-US", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	});

	return `${datePart} at ${timePart}`;
}

export function formatDateOnly(input: string | Date | number, locale?: string): string {
	const date = toDate(input);
	if (!date) return "—";
	const lang = activeLocale(locale);
	return new Intl.DateTimeFormat(lang, {
		year: "numeric",
		month: "short",
		day: "numeric",
	}).format(date);
}

export function formatDateTimeWithZone(input: string | Date | number, locale?: string): string {
	const date = toDate(input);
	if (!date) return "—";
	const lang = activeLocale(locale);
	return new Intl.DateTimeFormat(lang, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
		timeZoneName: "short",
	}).format(date);
}

export function formatDateCompact(input: string | Date | number, locale?: string): string {
	const date = toDate(input);
	if (!date) return "—";

	const resolved = activeLocale(locale).startsWith("zh") ? "zh-CN" : "en-US";
	return date.toLocaleString(resolved, {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
}

export function formatRelativeTime(input: string | Date | number, locale?: string): string {
	const date = toDate(input);
	if (!date) return "—";

	const diffMs = Math.max(0, Date.now() - date.getTime());
	const diffSec = Math.floor(diffMs / 1000);
	const diffMin = Math.floor(diffSec / 60);
	const diffHour = Math.floor(diffMin / 60);
	const diffDay = Math.floor(diffHour / 24);
	const isZh = activeLocale(locale).startsWith("zh");

	if (diffSec < 60) return isZh ? "刚刚" : "just now";
	if (diffMin < 60)
		return isZh ? `${diffMin} 分钟前` : `${diffMin} minute${diffMin > 1 ? "s" : ""} ago`;
	if (diffHour < 24)
		return isZh ? `${diffHour} 小时前` : `${diffHour} hour${diffHour > 1 ? "s" : ""} ago`;
	if (diffDay < 30) return isZh ? `${diffDay} 天前` : `${diffDay} day${diffDay > 1 ? "s" : ""} ago`;

	return formatDateCompact(input, locale);
}
