/**
 * 极简时间格式化工具 - 只支持display-short格式
 */

import {
	DateTimeError,
	type ParsedDateTime,
	TIME_PRECISION_CONFIG,
	type TimeKeyOptions,
} from "./types/datetime";

/**
 * ISO 8601 时间解析器
 */
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
			// 直接解析 ISO 格式，假设所有字符串都是标准 ISO 8601 格式
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

/**
 * 创建时间键（用于数据聚合和图表）
 * 确保本地时间处理，避免UTC转换陷阱
 */
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

	// 使用本地时间或UTC时间
	const targetDate = useLocalTime ? parsed.date : new Date(parsed.date.toISOString());
	const truncatedDate = config.truncate(targetDate);

	// 手动构建时间字符串，避免时区转换
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

/**
 * 格式化时间为 "Aug 23, 2025 at 17:44:27" 格式
 */
export function formatDate(input: string | Date | number): string {
	try {
		let date: Date;

		if (input instanceof Date) {
			date = input;
		} else if (typeof input === "number") {
			date = new Date(input);
		} else {
			// 直接解析 ISO 格式，不做向后兼容
			date = new Date(String(input).trim());
		}

		if (Number.isNaN(date.getTime())) {
			return "—";
		}

		const dateOptions: Intl.DateTimeFormatOptions = {
			year: "numeric",
			month: "short",
			day: "numeric",
		};

		const timeOptions: Intl.DateTimeFormatOptions = {
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
			hour12: false,
		};

		const datePart = date.toLocaleDateString("en-US", dateOptions);
		const timePart = date.toLocaleTimeString("en-US", timeOptions);

		return `${datePart} at ${timePart}`;
	} catch (_error) {
		return "—";
	}
}
