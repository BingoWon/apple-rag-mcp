import { createRoute, z } from "@hono/zod-openapi";
import type { AdminDashboardStats, AdminMetricStats, AdminStatsQuery } from "../../../../src/types";
import { logger } from "../../utils/logger";
import { createOpenAPIApp } from "../../utils/openapi";

const app = createOpenAPIApp();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const OFFSET = 8 * HOUR;
const METRICS = [
	{ key: "users", table: "users" },
	{ key: "tokens", table: "mcp_tokens" },
	{ key: "ips", table: "user_authorized_ips" },
	{ key: "searches", table: "search_logs" },
	{ key: "fetches", table: "fetch_logs" },
	{ key: "messages", table: "contact_messages" },
] as const;

function getRange(query: AdminStatsQuery, now: number) {
	const today = Math.floor((now + OFFSET) / DAY) * DAY - OFFSET;
	let start: number;
	let end = now;
	const bucket = query.period === "24h" ? "hour" : "day";
	if (query.period === "custom") {
		if (!query.start || !query.end) throw new Error("Select both start and end dates.");
		start = Date.parse(`${query.start}T00:00:00+08:00`);
		end = Date.parse(`${query.end}T00:00:00+08:00`) + DAY;
		if (start >= end) throw new Error("Start date must not be after end date.");
		if (end - DAY > today) throw new Error("End date must not be in the future.");
		if (end - start > 90 * DAY) throw new Error("Date range must not exceed 90 days.");
		end = Math.min(end, now);
	} else if (query.period === "24h") {
		start = now - DAY;
	} else {
		start = today - (query.period === "7d" ? 6 : 29) * DAY;
	}
	const step = bucket === "hour" ? HOUR : DAY;
	const firstBucket = Math.floor((start + OFFSET) / step) * step - OFFSET;
	return { start, end, bucket, step, firstBucket } as const;
}

const pointSchema = z.object({
	date: z.string(),
	count: z.number(),
	success: z.number().optional(),
	failed: z.number().optional(),
	limited: z.number().optional(),
	unknown: z.number().optional(),
});
const metricSchema = z.object({
	total: z.number(),
	points: z.array(pointSchema),
	outcomes: z
		.object({
			success: z.number(),
			failed: z.number(),
			limited: z.number(),
			unknown: z.number(),
		})
		.optional(),
});
const errorSchema = z.object({
	success: z.boolean(),
	error: z.object({ code: z.string(), message: z.string() }),
});
const statsRoute = createRoute({
	method: "get",
	path: "/",
	summary: "Get global admin statistics with hourly or daily trends",
	request: {
		query: z.object({
			period: z.enum(["24h", "7d", "30d", "custom"]).optional().default("7d"),
			start: z.iso.date().optional(),
			end: z.iso.date().optional(),
		}),
	},
	responses: {
		200: {
			description: "Global trends and current paid subscriptions",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.object({
							start: z.string(),
							end: z.string(),
							timezone: z.string(),
							bucket: z.enum(["hour", "day"]),
							generated_at: z.string(),
							metrics: z.object({
								users: metricSchema,
								tokens: metricSchema,
								ips: metricSchema,
								searches: metricSchema,
								fetches: metricSchema,
								messages: metricSchema,
							}),
							subscriptions: z.object({
								total: z.number(),
								pro: z.number(),
								enterprise: z.number(),
							}),
						}),
					}),
				},
			},
		},
		400: {
			description: "Invalid date range",
			content: { "application/json": { schema: errorSchema } },
		},
		500: {
			description: "Statistics unavailable",
			content: { "application/json": { schema: errorSchema } },
		},
	},
	tags: ["Admin"],
});

app.openapi(statsRoute, async (c) => {
	c.header("Cache-Control", "no-store");
	const now = Date.now();
	let range: ReturnType<typeof getRange>;
	try {
		range = getRange(c.req.valid("query"), now);
	} catch (error) {
		return c.json(
			{
				success: false,
				error: {
					code: "VALIDATION_ERROR",
					message: error instanceof Error ? error.message : "Invalid date range.",
				},
			},
			400,
		);
	}
	try {
		const start = new Date(range.start).toISOString();
		const end = new Date(range.end).toISOString();
		const format = range.bucket === "hour" ? "%Y-%m-%dT%H" : "%Y-%m-%d";
		const statements = METRICS.map(({ key, table }) => {
			const statuses =
				key === "searches" || key === "fetches"
					? `, SUM(CASE WHEN status_code = 200 THEN 1 ELSE 0 END) AS success
					   , SUM(CASE WHEN status_code NOT IN (200, 429) THEN 1 ELSE 0 END) AS failed
					   , SUM(CASE WHEN status_code = 429 THEN 1 ELSE 0 END) AS limited
					   , SUM(CASE WHEN status_code IS NULL THEN 1 ELSE 0 END) AS unknown`
					: "";
			// Date-prefix bounds retain index use; julianday handles both ISO and SQLite timestamps.
			return c.env.DB.prepare(
				`SELECT strftime('${format}', created_at, '+8 hours') AS bucket, COUNT(*) AS count ${statuses}
				 FROM ${table}
				 WHERE created_at >= ? AND created_at < ?
				   AND julianday(created_at) >= julianday(?) AND julianday(created_at) < julianday(?)
				 GROUP BY bucket ORDER BY bucket`,
			).bind(start.slice(0, 10), new Date(range.end + DAY).toISOString().slice(0, 10), start, end);
		});
		statements.push(
			c.env.DB.prepare(
				`SELECT plan_type, COUNT(*) AS count FROM user_subscriptions
				 WHERE status = 'active' AND plan_type IN ('pro', 'enterprise')
				   AND (payment_type != 'one_time' OR current_period_end IS NULL
				        OR julianday(current_period_end) >= julianday(?))
				 GROUP BY plan_type`,
			).bind(new Date(now).toISOString()),
		);
		const results = await c.env.DB.batch<Record<string, unknown>>(statements);
		const metrics = {} as AdminDashboardStats["metrics"];
		const lastBucket =
			range.bucket === "day" && range.end === now
				? Math.floor((now + OFFSET) / DAY) * DAY - OFFSET
				: range.end - 1;
		METRICS.forEach(({ key }, index) => {
			const hasStatus = key === "searches" || key === "fetches";
			const rows = new Map(results[index].results.map((row) => [String(row.bucket), row]));
			const metric: AdminMetricStats = {
				total: 0,
				points: [],
				...(hasStatus ? { outcomes: { success: 0, failed: 0, limited: 0, unknown: 0 } } : {}),
			};
			for (let timestamp = range.firstBucket; timestamp <= lastBucket; timestamp += range.step) {
				const bucket = new Date(timestamp + OFFSET)
					.toISOString()
					.slice(0, range.bucket === "hour" ? 13 : 10);
				const row = rows.get(bucket);
				const point = { date: new Date(timestamp).toISOString(), count: Number(row?.count) || 0 };
				metric.total += point.count;
				if (metric.outcomes) {
					const outcomes = {
						success: Number(row?.success) || 0,
						failed: Number(row?.failed) || 0,
						limited: Number(row?.limited) || 0,
						unknown: Number(row?.unknown) || 0,
					};
					for (const outcome of ["success", "failed", "limited", "unknown"] as const) {
						metric.outcomes[outcome] += outcomes[outcome];
					}
					metric.points.push({ ...point, ...outcomes });
				} else {
					metric.points.push(point);
				}
			}
			metrics[key] = metric;
		});
		const subscriptions = { total: 0, pro: 0, enterprise: 0 };
		for (const row of results[METRICS.length].results) {
			if (row.plan_type === "pro" || row.plan_type === "enterprise") {
				subscriptions[row.plan_type] = Number(row.count) || 0;
				subscriptions.total += Number(row.count) || 0;
			}
		}
		const data: AdminDashboardStats = {
			start,
			end,
			timezone: "Asia/Singapore",
			bucket: range.bucket,
			generated_at: new Date(now).toISOString(),
			metrics,
			subscriptions,
		};
		return c.json({ success: true, data }, 200);
	} catch (error) {
		await logger.error(
			`Admin statistics failed: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
		return c.json(
			{
				success: false,
				error: { code: "FETCH_FAILED", message: "Unable to load admin statistics." },
			},
			500,
		);
	}
});

export default app;
