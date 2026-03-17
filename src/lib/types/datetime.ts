/**
 * 时间处理系统类型定义
 */

export type TimePrecision = "minute" | "hour" | "day" | "month" | "year";

export interface TimeKeyOptions {
	precision: TimePrecision;
	useLocalTime?: boolean;
	includeTimezone?: boolean;
}

export interface ParsedDateTime {
	date: Date;
	isValid: boolean;
	hasTimezone: boolean;
	originalInput: string;
	error?: string;
}

/**
 * 时间处理错误类型
 */
export class DateTimeError extends Error {
	constructor(
		message: string,
		public readonly input?: unknown,
		public readonly operation?: string,
	) {
		super(message);
		this.name = "DateTimeError";
	}
}

/**
 * 时间精度配置
 */
export const TIME_PRECISION_CONFIG = {
	minute: {
		format: "YYYY-MM-DDTHH:mm:00",
		truncate: (date: Date) =>
			new Date(
				date.getFullYear(),
				date.getMonth(),
				date.getDate(),
				date.getHours(),
				date.getMinutes(),
				0,
				0,
			),
	},
	hour: {
		format: "YYYY-MM-DDTHH:00:00",
		truncate: (date: Date) =>
			new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), 0, 0, 0),
	},
	day: {
		format: "YYYY-MM-DDT00:00:00",
		truncate: (date: Date) =>
			new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0),
	},
	month: {
		format: "YYYY-MM-01T00:00:00",
		truncate: (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0),
	},
	year: {
		format: "YYYY-01-01T00:00:00",
		truncate: (date: Date) => new Date(date.getFullYear(), 0, 1, 0, 0, 0, 0),
	},
} as const;
