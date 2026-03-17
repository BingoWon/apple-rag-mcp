/**
 * Date formatting utilities
 */

/**
 * Format ISO date string to localized date and time
 * @param dateString - ISO date string
 * @returns Formatted date string (e.g., "2024-01-15 14:30")
 */
export function formatDate(dateString: string): string {
	const date = new Date(dateString);
	return date.toLocaleString("en-US", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
}

/**
 * Format ISO date string to relative time (e.g., "2 hours ago")
 * @param dateString - ISO date string
 * @returns Relative time string
 */
export function formatRelativeTime(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffSec = Math.floor(diffMs / 1000);
	const diffMin = Math.floor(diffSec / 60);
	const diffHour = Math.floor(diffMin / 60);
	const diffDay = Math.floor(diffHour / 24);

	if (diffSec < 60) return "just now";
	if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? "s" : ""} ago`;
	if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? "s" : ""} ago`;
	if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? "s" : ""} ago`;

	return formatDate(dateString);
}
