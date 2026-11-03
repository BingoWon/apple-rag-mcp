/** D1's timezone-free SQL timestamps are UTC, as are our ISO writes. */
export function parseUTCDate(input: unknown): Date | null {
	if (input === null || input === undefined || input === "") return null;
	if (!(typeof input === "string" || typeof input === "number" || input instanceof Date))
		return null;
	let value = input;
	if (typeof value === "string") {
		value = value.trim().replace(/^(\d{4}-\d{2}-\d{2}) /, "$1T");
		if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(value)) value += "Z";
	}
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}
