import {
	TOOL_KINDS,
	type ToolActivity,
	type ToolKind,
	type UsagePeriod,
} from "../../../shared/tool-activity.js";

// The text bounds use the index; julianday compares both SQLite and ISO timestamps precisely.
export const logWindowPredicate =
	"created_at >= ? AND created_at < ? AND julianday(created_at) >= julianday(?) AND julianday(created_at) < julianday(?)";
const HOUR = 3600000,
	DAY = 24 * HOUR,
	SINGAPORE = 8 * HOUR;
export function logWindowValues(from: string, to: string) {
	return [
		new Date(from).toISOString().slice(0, 10),
		new Date(Date.parse(to) + DAY).toISOString().slice(0, 10),
		from,
		to,
	];
}
export async function accountActivity(
	db: D1Database,
	userId: string,
	period: UsagePeriod,
	now = Date.now(),
): Promise<ToolActivity> {
	const hourly = period === "24h",
		step = hourly ? HOUR : DAY,
		offset = hourly ? 0 : SINGAPORE;
	const align = (ms: number) => Math.floor((ms + offset) / step) * step - offset;
	const start = hourly ? now - DAY : align(now) - (period === "7d" ? 6 : 29) * DAY;
	const from = new Date(start).toISOString(),
		to = new Date(now).toISOString();
	const branches = TOOL_KINDS.map(
		(
			tool,
		) => `SELECT '${tool}' AS tool,(CAST((unixepoch(created_at)+${offset / 1000})/${step / 1000} AS INTEGER)*${step}-${offset}) AS bucket,COUNT(*) AS n
 FROM ${tool}_logs WHERE user_id=? AND ${logWindowPredicate} GROUP BY bucket`,
	);
	const args = [userId, ...logWindowValues(from, to)];
	const rows = await db
		.prepare(branches.join(" UNION ALL "))
		.bind(...TOOL_KINDS.flatMap(() => args))
		.all<{ tool: ToolKind; bucket: number; n: number }>();
	const by_tool = { search: 0, browse: 0, fetch: 0 };
	const points: ToolActivity["points"] = [];
	const first = align(start);
	for (let ms = first; ms < now; ms += step)
		points.push({ date: new Date(ms).toISOString(), search: 0, browse: 0, fetch: 0 });
	for (const { tool, bucket, n } of rows.results) {
		const point = points[(bucket - first) / step];
		if (!point) throw new Error("Activity timestamp outside reporting window");
		point[tool] = n;
		by_tool[tool] += n;
	}
	return {
		start: from,
		end: to,
		bucket: hourly ? "hour" : "day",
		total: by_tool.search + by_tool.fetch + by_tool.browse,
		by_tool,
		points,
	};
}
