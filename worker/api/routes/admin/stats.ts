import { createRoute, z } from "@hono/zod-openapi";
import type {
	AdminDashboardStats,
	AdminMetricStats,
	AdminModelCosts,
	AdminStatsQuery,
	ModelCostCategory,
	ModelCostCurrency,
} from "../../../../src/types";
import { TOOL_CHANNELS, type ToolChannel } from "../../../shared/tool-channels.js";
import { emptyOutcomes, TOOL_OUTCOMES } from "../../../shared/tool-outcomes.js";
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
	degraded: z.number().optional(),
	no_content: z.number().optional(),
	invalid: z.number().optional(),
	failed: z.number().optional(),
	limited: z.number().optional(),
	cancelled: z.number().optional(),
	unknown: z.number().optional(),
	registered: z.number().optional(),
	anonymous: z.number().optional(),
});
const metricSchema = z.object({
	total: z.number(),
	points: z.array(pointSchema),
	outcomes: z
		.object({
			success: z.number(),
			degraded: z.number(),
			no_content: z.number(),
			invalid: z.number(),
			failed: z.number(),
			limited: z.number(),
			cancelled: z.number(),
			unknown: z.number(),
		})
		.optional(),
	breakdown: z
		.object({
			registered: z.number(),
			anonymous: z.number(),
		})
		.optional(),
});
const modelCostCategory = z.enum(["jev", "embedding", "reranking"]);
const modelCostCurrency = z.enum(["USD", "CNY"]);
const modelCostsSchema = z.object({
	first_recorded_at: z.string().nullable(),
	exchange_rate: z.number().nullable(),
	categories: z.record(
		modelCostCategory,
		z.object({ attempts: z.number(), unpriced_attempts: z.number() }),
	),
	currencies: z.partialRecord(
		modelCostCurrency,
		z.object({
			total_nanos: z.number(),
			categories: z.record(
				modelCostCategory,
				z.object({
					total_nanos: z.number(),
					priced_attempts: z.number(),
					points: z.array(z.object({ date: z.string(), count: z.number().nullable() })),
				}),
			),
		}),
	),
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
			channel: z.enum(TOOL_CHANNELS).optional(),
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
							model_costs: modelCostsSchema,
							billing: z.object({
								history_complete: z.boolean(),
								synced_at: z.string().nullable(),
								new_subscribers: metricSchema,
								renewing_subscribers: metricSchema,
								receipts: z.record(z.string(), metricSchema),
							}),
							channels: z.object({ mcp: metricSchema, cli: metricSchema, unknown: metricSchema }),
							metrics: z.object({
								users: metricSchema,
								tokens: metricSchema,
								ips: metricSchema,
								searches: metricSchema,
								fetches: metricSchema,
								messages: metricSchema,
								new_users: metricSchema,
								active_users: metricSchema,
								cumulative_users: metricSchema,
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
	const query = c.req.valid("query");
	let range: ReturnType<typeof getRange>;
	try {
		range = getRange(query, now);
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
			const isRequest = key === "searches" || key === "fetches";
			const statuses =
				key === "searches" || key === "fetches"
					? TOOL_OUTCOMES.map(
							(outcome) =>
								`, SUM(CASE WHEN outcome = '${outcome}' THEN 1 ELSE 0 END) AS ${outcome}`,
						).join("")
					: "";
			// Date-prefix bounds retain index use; julianday handles both ISO and SQLite timestamps.
			return c.env.DB.prepare(
				`SELECT strftime('${format}', created_at, '+8 hours') AS bucket, COUNT(*) AS count ${statuses}${isRequest ? ", channel" : ""}
				 FROM ${table}
				 WHERE created_at >= ? AND created_at < ?
				   AND julianday(created_at) >= julianday(?) AND julianday(created_at) < julianday(?)
				 GROUP BY bucket${isRequest ? ", channel" : ""} ORDER BY bucket`,
			).bind(start.slice(0, 10), new Date(range.end + DAY).toISOString().slice(0, 10), start, end);
		});
		const newAnonymousQuery = c.env.DB.prepare(
			`WITH all_logs AS (
				SELECT user_id, created_at FROM search_logs WHERE user_id LIKE 'anon_%' ESCAPE '\\'
				UNION ALL
				SELECT user_id, created_at FROM fetch_logs WHERE user_id LIKE 'anon_%' ESCAPE '\\'
			), first_seen AS (
				SELECT user_id, MIN(created_at) AS first_seen FROM all_logs GROUP BY user_id
			)
			SELECT CASE
					WHEN julianday(first_seen) < julianday(?) THEN '__before__'
					ELSE strftime('${format}', first_seen, '+8 hours')
				END AS bucket,
				COUNT(*) AS count
			FROM first_seen
			WHERE julianday(first_seen) < julianday(?)
			GROUP BY bucket ORDER BY bucket`,
		).bind(start, end);
		const activeUsersQuery = c.env.DB.prepare(
			`WITH all_logs AS (
				SELECT user_id, created_at FROM search_logs
				WHERE created_at >= ? AND created_at < ?
				  AND julianday(created_at) >= julianday(?) AND julianday(created_at) < julianday(?)
				UNION ALL
				SELECT user_id, created_at FROM fetch_logs
				WHERE created_at >= ? AND created_at < ?
				  AND julianday(created_at) >= julianday(?) AND julianday(created_at) < julianday(?)
			)
			SELECT strftime('${format}', created_at, '+8 hours') AS bucket,
				COUNT(DISTINCT CASE WHEN user_id NOT LIKE 'anon_%' ESCAPE '\\' THEN user_id END) AS registered,
				COUNT(DISTINCT CASE WHEN user_id LIKE 'anon_%' ESCAPE '\\' THEN user_id END) AS anonymous
			FROM all_logs GROUP BY bucket ORDER BY bucket`,
		).bind(
			start.slice(0, 10),
			new Date(range.end + DAY).toISOString().slice(0, 10),
			start,
			end,
			start.slice(0, 10),
			new Date(range.end + DAY).toISOString().slice(0, 10),
			start,
			end,
		);
		const activeTotalQuery = c.env.DB.prepare(
			`WITH all_logs AS (
				SELECT user_id, created_at FROM search_logs
				WHERE created_at >= ? AND created_at < ?
				  AND julianday(created_at) >= julianday(?) AND julianday(created_at) < julianday(?)
				UNION ALL
				SELECT user_id, created_at FROM fetch_logs
				WHERE created_at >= ? AND created_at < ?
				  AND julianday(created_at) >= julianday(?) AND julianday(created_at) < julianday(?)
			)
			SELECT COUNT(DISTINCT CASE WHEN user_id NOT LIKE 'anon_%' ESCAPE '\\' THEN user_id END) AS registered,
				COUNT(DISTINCT CASE WHEN user_id LIKE 'anon_%' ESCAPE '\\' THEN user_id END) AS anonymous
			FROM all_logs`,
		).bind(
			start.slice(0, 10),
			new Date(range.end + DAY).toISOString().slice(0, 10),
			start,
			end,
			start.slice(0, 10),
			new Date(range.end + DAY).toISOString().slice(0, 10),
			start,
			end,
		);
		const registeredBaselineQuery = c.env.DB.prepare(
			"SELECT COUNT(*) AS count FROM users WHERE julianday(created_at) < julianday(?)",
		).bind(start);
		statements.push(newAnonymousQuery, activeUsersQuery, activeTotalQuery, registeredBaselineQuery);
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
		const channels: AdminDashboardStats["channels"] = {
			mcp: { total: 0, points: [] },
			cli: { total: 0, points: [] },
			unknown: { total: 0, points: [] },
		};
		const channelBuckets = new Map<string, Record<ToolChannel, number>>();
		const lastBucket =
			range.bucket === "day" && range.end === now
				? Math.floor((now + OFFSET) / DAY) * DAY - OFFSET
				: range.end - 1;
		METRICS.forEach(({ key }, index) => {
			const hasStatus = key === "searches" || key === "fetches";
			const rows = new Map<string, Record<string, unknown>>();
			for (const row of results[index].results) {
				const bucket = String(row.bucket);
				if (hasStatus) {
					const channel = TOOL_CHANNELS.includes(row.channel as ToolChannel)
						? (row.channel as ToolChannel)
						: "unknown";
					const count = Number(row.count) || 0;
					const counts = channelBuckets.get(bucket) ?? { mcp: 0, cli: 0, unknown: 0 };
					counts[channel] += count;
					channelBuckets.set(bucket, counts);
					channels[channel].total += count;
					if (query.channel && channel !== query.channel) continue;
				}
				const totals = rows.get(bucket) ?? {};
				for (const field of hasStatus ? ["count", ...TOOL_OUTCOMES] : ["count"]) {
					totals[field] = Number(totals[field] ?? 0) + Number(row[field] ?? 0);
				}
				rows.set(bucket, totals);
			}
			const metric: AdminMetricStats = {
				total: 0,
				points: [],
				...(hasStatus ? { outcomes: emptyOutcomes() } : {}),
			};
			for (let timestamp = range.firstBucket; timestamp <= lastBucket; timestamp += range.step) {
				const bucket = new Date(timestamp + OFFSET)
					.toISOString()
					.slice(0, range.bucket === "hour" ? 13 : 10);
				const row = rows.get(bucket);
				const point = { date: new Date(timestamp).toISOString(), count: Number(row?.count) || 0 };
				metric.total += point.count;
				if (metric.outcomes) {
					const outcomes = emptyOutcomes();
					for (const outcome of TOOL_OUTCOMES) {
						outcomes[outcome] = Number(row?.[outcome]) || 0;
						metric.outcomes[outcome] += outcomes[outcome];
					}
					metric.points.push({ ...point, ...outcomes });
				} else {
					metric.points.push(point);
				}
			}
			metrics[key] = metric;
		});
		const pointBucket = (date: string) =>
			new Date(Date.parse(date) + OFFSET).toISOString().slice(0, range.bucket === "hour" ? 13 : 10);
		for (const channel of TOOL_CHANNELS) {
			channels[channel].points = metrics.searches.points.map((point) => ({
				date: point.date,
				count: channelBuckets.get(pointBucket(point.date))?.[channel] ?? 0,
			}));
		}
		const newAnonymousRows = new Map(
			results[METRICS.length].results.map((row) => [String(row.bucket), row]),
		);
		const newUsers: AdminMetricStats = {
			total: metrics.users.total,
			points: [],
			breakdown: { registered: metrics.users.total, anonymous: 0 },
		};
		for (const point of metrics.users.points) {
			const row = newAnonymousRows.get(pointBucket(point.date));
			const anonymous = Number(row?.count) || 0;
			newUsers.total += anonymous;
			newUsers.breakdown!.anonymous += anonymous;
			newUsers.points.push({
				...point,
				count: point.count + anonymous,
				registered: point.count,
				anonymous,
			});
		}
		metrics.new_users = newUsers;
		const registeredBaseline = Number(results[METRICS.length + 3].results[0]?.count) || 0;
		const anonymousBaseline = Number(newAnonymousRows.get("__before__")?.count) || 0;
		let registeredTotal = registeredBaseline;
		let anonymousTotal = anonymousBaseline;
		const cumulativePoints = newUsers.points.map((point) => {
			registeredTotal += point.registered ?? 0;
			anonymousTotal += point.anonymous ?? 0;
			return {
				date: point.date,
				count: registeredTotal + anonymousTotal,
				registered: registeredTotal,
				anonymous: anonymousTotal,
			};
		});
		metrics.cumulative_users = {
			total: registeredTotal + anonymousTotal,
			points: cumulativePoints,
			breakdown: { registered: registeredTotal, anonymous: anonymousTotal },
		};

		const activeRows = new Map(
			results[METRICS.length + 1].results.map((row) => [String(row.bucket), row]),
		);
		const activePoints: AdminMetricStats["points"] = [];
		for (let timestamp = range.firstBucket; timestamp <= lastBucket; timestamp += range.step) {
			const bucket = new Date(timestamp + OFFSET)
				.toISOString()
				.slice(0, range.bucket === "hour" ? 13 : 10);
			const row = activeRows.get(bucket);
			const registered = Number(row?.registered) || 0;
			const anonymous = Number(row?.anonymous) || 0;
			activePoints.push({
				date: new Date(timestamp).toISOString(),
				count: registered + anonymous,
				registered,
				anonymous,
			});
		}
		const activeTotal = results[METRICS.length + 2].results[0];
		metrics.active_users = {
			total: (Number(activeTotal?.registered) || 0) + (Number(activeTotal?.anonymous) || 0),
			points: activePoints,
			breakdown: {
				registered: Number(activeTotal?.registered) || 0,
				anonymous: Number(activeTotal?.anonymous) || 0,
			},
		};

		const subscriptions = { total: 0, pro: 0, enterprise: 0 };
		for (const row of results[METRICS.length + 4].results) {
			if (row.plan_type === "pro" || row.plan_type === "enterprise") {
				subscriptions[row.plan_type] = Number(row.count) || 0;
				subscriptions.total += Number(row.count) || 0;
			}
		}
		const modelCostQuery = c.env.DB.prepare(
			`SELECT strftime('${format}', created_at, '+8 hours') AS bucket,
			        category, currency, COUNT(*) AS attempts, COUNT(cost_nanos) AS priced_attempts,
			        SUM(cost_nanos) AS cost_nanos
			 FROM model_usage_events WHERE created_at >= ? AND created_at < ?
			 ${query.channel ? "AND channel = ?" : ""}
			 GROUP BY bucket, category, currency`,
		).bind(start, end, ...(query.channel ? [query.channel] : []));
		const [receipts, billingPeople, billingTotals, billingSync, modelRows, modelCoverage] =
			await c.env.DB.batch<Record<string, unknown>>([
				c.env.DB.prepare(
					`SELECT strftime('${format}',paid_at,'+8 hours') AS bucket, currency, SUM(amount_paid) AS amount FROM subscription_receipts WHERE paid_at >= ? AND paid_at < ? GROUP BY bucket,currency`,
				).bind(start, end),
				c.env.DB.prepare(
					`SELECT strftime('${format}',paid_at,'+8 hours') AS bucket, billing_reason, COUNT(DISTINCT customer_key) AS count FROM subscription_receipts WHERE paid_at >= ? AND paid_at < ? GROUP BY bucket,billing_reason`,
				).bind(start, end),
				c.env.DB.prepare(
					`SELECT billing_reason,COUNT(DISTINCT customer_key) AS count FROM subscription_receipts WHERE paid_at >= ? AND paid_at < ? GROUP BY billing_reason`,
				).bind(start, end),
				c.env.DB.prepare("SELECT completed_at FROM billing_history_sync WHERE id=1"),
				modelCostQuery,
				c.env.DB.prepare("SELECT MIN(created_at) AS first_recorded_at FROM model_usage_events"),
			]);
		const modelCosts = summarizeModelCosts(
			modelRows.results,
			modelCoverage.results[0]?.first_recorded_at,
			metrics.searches.points.map(({ date }) => date),
			pointBucket,
			Number(c.env.MODEL_COST_CNY_PER_USD),
		);
		const billing: AdminDashboardStats["billing"] = {
			history_complete: billingSync.results.length > 0,
			synced_at: billingSync.results[0]?.completed_at
				? String(billingSync.results[0].completed_at)
				: null,
			new_subscribers: { total: 0, points: [] },
			renewing_subscribers: { total: 0, points: [] },
			receipts: {},
		};
		for (const [key, reason] of [
			["new_subscribers", "subscription_create"],
			["renewing_subscribers", "subscription_cycle"],
		] as const) {
			billing[key].total = Number(
				billingTotals.results.find((row) => row.billing_reason === reason)?.count ?? 0,
			);
			billing[key].points = metrics.searches.points.map((point) => ({
				date: point.date,
				count: Number(
					billingPeople.results.find(
						(row) => row.bucket === pointBucket(point.date) && row.billing_reason === reason,
					)?.count ?? 0,
				),
			}));
		}
		for (const row of receipts.results) {
			const currency = String(row.currency);
			billing.receipts[currency] ??= {
				total: 0,
				points: metrics.searches.points.map((point) => ({ date: point.date, count: 0 })),
			};
			billing.receipts[currency].total += Number(row.amount);
			const point = billing.receipts[currency].points.find(
				(point) => pointBucket(point.date) === row.bucket,
			);
			if (point) point.count += Number(row.amount);
		}
		const data: AdminDashboardStats = {
			billing,
			model_costs: modelCosts,
			start,
			end,
			timezone: "Asia/Singapore",
			bucket: range.bucket,
			generated_at: new Date(now).toISOString(),
			metrics,
			channels,
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

function summarizeModelCosts(
	rows: Record<string, unknown>[],
	firstRecordedAt: unknown,
	dates: string[],
	pointBucket: (date: string) => string,
	exchangeRate: number,
): AdminModelCosts {
	const categories: AdminModelCosts["categories"] = {
		jev: { attempts: 0, unpriced_attempts: 0 },
		embedding: { attempts: 0, unpriced_attempts: 0 },
		reranking: { attempts: 0, unpriced_attempts: 0 },
	};
	const currencies: AdminModelCosts["currencies"] = {};
	const firstRecorded = typeof firstRecordedAt === "string" ? firstRecordedAt : null;
	const firstBucket = firstRecorded ? pointBucket(firstRecorded) : null;
	const bucketIndices = new Map(dates.map((date, index) => [pointBucket(date), index]));
	const series = () => ({
		total_nanos: 0,
		priced_attempts: 0,
		points: dates.map((date) => ({
			date,
			count: firstBucket && pointBucket(date) >= firstBucket ? 0 : null,
		})),
	});
	for (const row of rows) {
		const category = row.category as ModelCostCategory;
		const attempts = Number(row.attempts);
		const pricedAttempts = Number(row.priced_attempts);
		categories[category].attempts += attempts;
		categories[category].unpriced_attempts += attempts - pricedAttempts;
		if (row.cost_nanos == null) continue;
		const currency = row.currency as ModelCostCurrency;
		currencies[currency] ??= {
			total_nanos: 0,
			categories: { jev: series(), embedding: series(), reranking: series() },
		};
		const totals = currencies[currency];
		const cost = Number(row.cost_nanos);
		const metric = totals.categories[category];
		totals.total_nanos += cost;
		metric.total_nanos += cost;
		metric.priced_attempts += pricedAttempts;
		const index = bucketIndices.get(String(row.bucket));
		if (index !== undefined) metric.points[index].count = cost;
	}
	return {
		first_recorded_at: firstRecorded,
		exchange_rate: Number.isFinite(exchangeRate) && exchangeRate > 0 ? exchangeRate : null,
		categories,
		currencies,
	};
}

export default app;
