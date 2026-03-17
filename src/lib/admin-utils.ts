/**
 * Admin-specific utility functions
 * Specialized formatting and processing for admin pages
 */

/**
 * Format ISO datetime string to local timezone in admin format
 * Converts from UTC to local timezone and formats as "YYYY-MM-DD HH:mm:ss"
 *
 * @param isoDateString - ISO datetime string from database (e.g., "2025-08-23T12:08:19.000Z")
 * @returns Formatted local datetime string (e.g., "2025-08-23 16:08:19")
 */
export function formatAdminDateTime(isoDateString: string | null | undefined): string {
	if (!isoDateString) {
		return "N/A";
	}

	try {
		// Parse ISO datetime string and create Date object
		// Database now uses ISO format: "2025-08-23T12:08:19.000Z"
		const utcDate = new Date(isoDateString);

		// Check if date is valid
		if (Number.isNaN(utcDate.getTime())) {
			return "Invalid Date";
		}

		// Format to local timezone in admin format: YYYY-MM-DD HH:mm:ss
		const year = utcDate.getFullYear();
		const month = String(utcDate.getMonth() + 1).padStart(2, "0");
		const day = String(utcDate.getDate()).padStart(2, "0");
		const hours = String(utcDate.getHours()).padStart(2, "0");
		const minutes = String(utcDate.getMinutes()).padStart(2, "0");
		const seconds = String(utcDate.getSeconds()).padStart(2, "0");

		return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
	} catch (error) {
		console.error("Error formatting admin datetime:", error, "Input:", isoDateString);
		return "Format Error";
	}
}

/**
 * Format response time from milliseconds to seconds with one decimal place
 */
export function formatAdminResponseTime(responseTimeMs: number | null | undefined): string {
	if (responseTimeMs === null || responseTimeMs === undefined) {
		return "N/A";
	}
	return `${(responseTimeMs / 1000).toFixed(1)}s`;
}

/**
 * Convert ISO 3166-1 Alpha-2 country code to flag emoji
 * Uses Unicode Regional Indicator Symbols
 */
export function getCountryFlag(countryCode: string | null | undefined): string {
	if (!countryCode || countryCode.length !== 2) {
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
