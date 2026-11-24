import { parseUTCDate } from "../../shared/datetime";
/**
 * Admin-specific utility functions
 * Specialized formatting and processing for admin pages
 */

/**
 * Format D1/ISO timestamps in the admin dashboard timezone (UTC+8)
 * Converts from UTC to Asia/Singapore and formats as "YYYY-MM-DD HH:mm:ss"
 *
 * @param isoDateString - ISO datetime string from database (e.g., "2025-08-23T12:08:19.000Z")
 * @returns Formatted local datetime string (e.g., "2025-08-23 20:08:19")
 */
export function formatAdminDateTime(value: string | null | undefined): string {
	const date = parseUTCDate(value);
	return date
		? new Intl.DateTimeFormat("sv-SE", {
				timeZone: "Asia/Singapore",
				year: "numeric",
				month: "2-digit",
				day: "2-digit",
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
				hourCycle: "h23",
			}).format(date)
		: "—";
}

/**
 * Format response time from milliseconds to seconds with one decimal place
 */
export function formatAdminResponseTime(responseTimeMs: number | null | undefined): string {
	if (responseTimeMs === null || responseTimeMs === undefined) {
		return "—";
	}
	return `${(responseTimeMs / 1000).toFixed(1)}s`;
}

/**
 * Convert ISO 3166-1 Alpha-2 country code to flag emoji
 * Uses Unicode Regional Indicator Symbols
 */
export function getCountryFlag(countryCode: string | null | undefined): string {
	if (countryCode?.length !== 2) {
		return "🌍";
	}
	if (countryCode === "T1") {
		return "🧅"; // TOR network
	}
	const codePoints = countryCode
		.toUpperCase()
		.split("")
		.map((char) => 127397 + char.charCodeAt(0));
	return String.fromCodePoint(...codePoints);
}
