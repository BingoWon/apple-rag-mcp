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

function toDate(input: string | Date | number): Date | null {
	const date =
		input instanceof Date ? input : new Date(typeof input === "string" ? input.trim() : input);
	return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(input: string | Date | number): string {
	const date = toDate(input);
	if (!date) return "—";

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

export function formatDateCompact(input: string | Date | number): string {
	const date = toDate(input);
	if (!date) return "—";

	return date.toLocaleString("en-US", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
}

export function formatRelativeTime(input: string | Date | number): string {
	const date = toDate(input);
	if (!date) return "—";

	const diffMs = Date.now() - date.getTime();
	const diffSec = Math.floor(diffMs / 1000);
	const diffMin = Math.floor(diffSec / 60);
	const diffHour = Math.floor(diffMin / 60);
	const diffDay = Math.floor(diffHour / 24);

	if (diffSec < 60) return "just now";
	if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? "s" : ""} ago`;
	if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? "s" : ""} ago`;
	if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? "s" : ""} ago`;

	return formatDateCompact(input);
}
