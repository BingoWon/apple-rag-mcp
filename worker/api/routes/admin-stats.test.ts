import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { AdminDashboardStats } from "../../../src/types/index.js";
import app from "./admin/index.js";

const NOW = Date.parse("2026-10-09T04:15:00.000Z");

function createDatabase(rate?: string) {
	const sqlite = new DatabaseSync(":memory:");
	const directory = new URL("../../../migrations/", import.meta.url);
	for (const file of readdirSync(directory)
		.filter((name) => name.endsWith(".sql"))
		.sort()) {
		sqlite.exec(readFileSync(new URL(file, directory), "utf8"));
	}
	const queries: string[] = [];
	const db = {
		prepare(sql: string) {
			queries.push(sql);
			let values: (string | number | null)[] = [];
			return {
				bind(...args: (string | number | null)[]) {
					values = args;
					return this;
				},
				async all() {
					return { success: true, results: sqlite.prepare(sql).all(...values) };
				},
			};
		},
		async batch(statements: { all(): Promise<unknown> }[]) {
			return Promise.all(statements.map((statement) => statement.all()));
		},
	};
	const request = (query = "period=7d") =>
		app.request(
			`/stats?${query}`,
			{ headers: { "X-Admin-Password": "test-admin" } },
			{
				ADMIN_PASSWORD: "test-admin",
				MODEL_COST_CNY_PER_USD: rate,
				DB: db as unknown as D1Database,
			},
		);
	return { sqlite, queries, request };
}

function insertUser(sqlite: DatabaseSync, id: string, createdAt: string) {
	sqlite
		.prepare("INSERT INTO users (id, email, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
		.run(id, `${id}@example.com`, id, createdAt, createdAt);
}

function insertLog(
	sqlite: DatabaseSync,
	table: "search_logs" | "fetch_logs",
	createdAt: string,
	status: number | null,
	userId = "anon_203.0.113.10",
	channel = "unknown",
) {
	const columns =
		table === "search_logs" ? "requested_query, actual_query" : "requested_url, actual_url";
	sqlite
		.prepare(
			`INSERT INTO ${table} (user_id, ${columns}, status_code, outcome, created_at, channel) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		)
		.run(
			userId,
			"test",
			"test",
			status,
			status === 200
				? "success"
				: status === 429
					? "limited"
					: status === 404
						? "no_content"
						: status === null
							? "unknown"
							: "failed",
			createdAt,
			channel,
		);
}

test("admin statistics require the existing password before querying data", async () => {
	for (const headers of [{}, { "X-Admin-Password": "wrong" }]) {
		const response = await app.request(
			"/stats",
			{ headers },
			{
				ADMIN_PASSWORD: "test-admin",
				DB: {
					prepare: () => {
						throw new Error("Unauthorized query");
					},
				} as unknown as D1Database,
			},
		);
		assert.equal(response.status, 401);
	}
});

test("global daily statistics handle SQLite/ISO dates, Singapore boundaries, outcomes and missing days", async (t) => {
	t.mock.method(Date, "now", () => NOW);
	const { sqlite, queries, request } = createDatabase();
	t.after(() => sqlite.close());
	insertUser(sqlite, "start", "2026-10-02T16:00:00.000Z");
	insertUser(sqlite, "today", "2026-10-08 16:30:00");
	insertUser(sqlite, "before", "2026-10-02T15:59:59.999Z");
	insertUser(sqlite, "future", "2026-10-09T04:15:00.000Z");
	for (const [date, status] of [
		["2026-10-02T16:00:00.000Z", 200],
		["2026-10-03 23:20:00", 500],
		["2026-10-08T17:00:00.000Z", 429],
		["2026-10-08 18:00:00", null],
		["2026-10-08T19:00:00.000Z", 503],
		["2026-10-02T15:59:59.999Z", 200],
		["2026-10-09T04:15:00.000Z", 200],
	] as const)
		insertLog(sqlite, "search_logs", date, status);
	insertLog(sqlite, "fetch_logs", "2026-10-08T20:00:00Z", 200);
	insertLog(sqlite, "fetch_logs", "2026-10-08 20:30:00", 404);
	sqlite
		.prepare(
			"INSERT INTO mcp_tokens (id, user_id, mcp_token, name, created_at) VALUES (?, ?, ?, ?, ?)",
		)
		.run("token", "today", "test-token", "Test", "2026-10-08 23:00:00");
	sqlite
		.prepare(
			"INSERT INTO user_authorized_ips (user_id, ip_address, name, created_at) VALUES (?, ?, ?, ?)",
		)
		.run("today", "203.0.113.1", "Test IP", "2026-10-08T23:00:00Z");
	sqlite
		.prepare("INSERT INTO contact_messages (message, created_at) VALUES (?, ?)")
		.run("Feedback", "2026-10-08 23:00:00");
	const response = await request();
	assert.equal(response.status, 200);
	assert.equal(response.headers.get("Cache-Control"), "no-store");
	const { data } = (await response.json()) as { data: AdminDashboardStats };
	assert.equal(data.timezone, "Asia/Singapore");
	assert.equal(data.model_costs.exchange_rate, null);
	assert.equal(data.start, "2026-10-02T16:00:00.000Z");
	assert.equal(data.end, new Date(NOW).toISOString());
	assert.equal(data.metrics.users.total, 2);
	assert.equal(data.metrics.new_users.total, 2);
	assert.equal(data.metrics.active_users.total, 1);
	assert.equal(data.metrics.new_users.breakdown?.registered, 2);
	assert.equal(data.metrics.new_users.breakdown?.anonymous, 0);
	assert.equal(data.metrics.active_users.breakdown?.anonymous, 1);
	assert.equal(data.metrics.cumulative_users.total, 4);
	assert.deepEqual(data.metrics.cumulative_users.breakdown, { registered: 3, anonymous: 1 });
	assert.equal(data.metrics.cumulative_users.points[0]?.registered, 2);
	assert.equal(data.metrics.cumulative_users.points[0]?.anonymous, 1);
	assert.equal(data.metrics.cumulative_users.points.at(-1)?.count, 4);
	assert.ok(
		data.metrics.cumulative_users.points.every(
			(point, index, points) => index === 0 || point.count >= points[index - 1].count,
		),
	);
	assert.equal(data.metrics.tokens.total, 1);
	assert.equal(data.metrics.ips.total, 1);
	assert.equal(data.metrics.messages.total, 1);
	assert.equal(data.metrics.searches.total, 5);
	assert.equal(data.metrics.fetches.total, 2);
	assert.deepEqual(data.metrics.searches.outcomes, {
		success: 1,
		degraded: 0,
		no_content: 0,
		invalid: 0,
		failed: 2,
		limited: 1,
		cancelled: 0,
		unknown: 1,
	});
	assert.deepEqual(data.metrics.fetches.outcomes, {
		success: 1,
		degraded: 0,
		no_content: 1,
		invalid: 0,
		failed: 0,
		limited: 0,
		cancelled: 0,
		unknown: 0,
	});
	assert.equal(data.metrics.searches.points[0].count, 1);
	assert.equal(data.metrics.searches.points[2].count, 0);
	assert.equal(data.metrics.searches.points.at(-1)?.count, 3);
	for (const [key, metric] of Object.entries(data.metrics)) {
		assert.equal(metric.points.length, 7);
		if (key !== "active_users" && key !== "cumulative_users") {
			assert.equal(
				metric.total,
				metric.points.reduce((sum, point) => sum + point.count, 0),
			);
		}
	}
	for (const table of ["search_logs", "fetch_logs"]) {
		const sql = queries.find((query) => query.includes(`FROM ${table}`))!;
		const plan = sqlite
			.prepare(`EXPLAIN QUERY PLAN ${sql}`)
			.all("2026-10-02", "2026-10-10", data.start, data.end);
		assert.ok(
			plan.some(
				(row) =>
					String(row.detail).includes(`SEARCH ${table} USING INDEX`) ||
					String(row.detail).includes(`SEARCH ${table} USING COVERING INDEX`),
			),
		);
	}
	assert.doesNotMatch(JSON.stringify(data), /anon_|test-token|example\.com|requested_query/);
});

test("new and active user metrics count first-seen anonymous identities and deduplicate tools", async (t) => {
	t.mock.method(Date, "now", () => NOW);
	const { sqlite, request } = createDatabase();
	t.after(() => sqlite.close());
	insertUser(sqlite, "registered-new", "2026-10-08T20:00:00.000Z");
	insertUser(sqlite, "registered-old", "2026-10-01T00:00:00.000Z");
	insertLog(sqlite, "search_logs", "2026-10-01T12:00:00.000Z", 200, "anon_return");
	insertLog(sqlite, "search_logs", "2026-10-07T20:00:00.000Z", 200, "anon_return");
	insertLog(sqlite, "search_logs", "2026-10-08T20:00:00.000Z", 200, "anon_return");
	insertLog(sqlite, "search_logs", "2026-10-08T21:00:00.000Z", 200, "anon_new");
	insertLog(sqlite, "fetch_logs", "2026-10-08T22:00:00.000Z", 200, "anon_new");
	insertLog(sqlite, "search_logs", "2026-10-08T22:30:00.000Z", 200, "registered-new");
	insertLog(sqlite, "fetch_logs", "2026-10-08T22:45:00.000Z", 200, "registered-new");
	const response = await request();
	const { data } = (await response.json()) as { data: AdminDashboardStats };
	assert.equal(response.status, 200);
	assert.equal(data.metrics.users.total, 1);
	assert.equal(data.metrics.new_users.total, 2);
	assert.deepEqual(data.metrics.new_users.breakdown, { registered: 1, anonymous: 1 });
	assert.equal(data.metrics.active_users.total, 3);
	assert.deepEqual(data.metrics.active_users.breakdown, { registered: 1, anonymous: 2 });
	assert.equal(data.metrics.new_users.points.at(-1)?.count, 2);
	assert.equal(data.metrics.active_users.points.at(-1)?.count, 3);
	assert.equal(data.metrics.active_users.points.at(-1)?.registered, 1);
	assert.equal(data.metrics.active_users.points.at(-1)?.anonymous, 2);
	assert.equal(data.metrics.cumulative_users.total, 4);
	assert.deepEqual(data.metrics.cumulative_users.breakdown, { registered: 2, anonymous: 2 });
	assert.equal(data.metrics.cumulative_users.points[0]?.count, 2);
	assert.equal(data.metrics.cumulative_users.points.at(-1)?.registered, 2);
	assert.equal(data.metrics.cumulative_users.points.at(-1)?.anonymous, 2);
	assert.ok(
		data.metrics.active_users.total <
			data.metrics.active_users.points.reduce((sum, point) => sum + point.count, 0),
	);
});

test("rolling 24h statistics exclude partial-hour records before the window and group hourly", async (t) => {
	t.mock.method(Date, "now", () => NOW);
	const { sqlite, request } = createDatabase();
	t.after(() => sqlite.close());
	insertLog(sqlite, "search_logs", "2026-10-08 04:14:59", 200);
	insertLog(sqlite, "search_logs", "2026-10-08T04:15:00.000Z", 200);
	insertLog(sqlite, "search_logs", "2026-10-08 05:30:00", 429);
	insertLog(sqlite, "search_logs", "2026-10-09T04:15:00.000Z", 200);
	const response = await request("period=24h");
	const { data } = (await response.json()) as { data: AdminDashboardStats };
	assert.equal(response.status, 200);
	assert.equal(data.bucket, "hour");
	assert.equal(data.start, "2026-10-08T04:15:00.000Z");
	assert.equal(data.metrics.searches.total, 2);
	assert.equal(data.metrics.searches.points.length, 25);
	assert.equal(data.metrics.searches.points[0].date, "2026-10-08T04:00:00.000Z");
	assert.equal(data.metrics.searches.points[0].count, 1);
	assert.equal(data.metrics.searches.points[1].limited, 1);
});

test("custom range includes the entire final Singapore day and caps today's data at now", async (t) => {
	t.mock.method(Date, "now", () => NOW);
	const { sqlite, request } = createDatabase();
	t.after(() => sqlite.close());
	for (const date of [
		"2026-10-07T15:59:59.999Z",
		"2026-10-07T16:00:00.000Z",
		"2026-10-08 15:59:59",
		"2026-10-08T16:00:00.000Z",
	])
		insertLog(sqlite, "search_logs", date, 200);
	const response = await request("period=custom&start=2026-10-08&end=2026-10-08");
	const { data } = (await response.json()) as { data: AdminDashboardStats };
	assert.equal(response.status, 200);
	assert.equal(data.metrics.searches.total, 2);
	assert.equal(data.metrics.searches.points.length, 1);
	assert.equal(data.end, "2026-10-08T16:00:00.000Z");
	const todayResponse = await request("period=custom&start=2026-10-09&end=2026-10-09");
	const todayData = (await todayResponse.json()) as { data: AdminDashboardStats };
	assert.equal(todayData.data.end, new Date(NOW).toISOString());
	const month = await request("period=30d");
	const monthData = (await month.json()) as { data: AdminDashboardStats };
	assert.equal(monthData.data.metrics.users.points.length, 30);
});

test("invalid, reversed, future and oversized ranges are rejected before querying", async (t) => {
	t.mock.method(Date, "now", () => NOW);
	const { sqlite, request, queries } = createDatabase();
	t.after(() => sqlite.close());
	for (const query of [
		"period=invalid",
		"period=custom",
		"period=custom&start=2026-10-09&end=2026-10-08",
		"period=custom&start=2026-10-09&end=2026-10-10",
		"period=custom&start=2026-01-01&end=2026-10-08",
		"period=custom&start=2026-02-30&end=2026-03-01",
		"period=custom&start=malformed&end=2026-10-09",
		"period=7d&channel=spoof",
	]) {
		const response = await request(query);
		assert.equal(response.status, 400, query);
	}
	assert.equal(queries.length, 0);
});

test("daily windows include today's empty bucket at Singapore midnight", async (t) => {
	t.mock.method(Date, "now", () => Date.parse("2026-10-08T16:00:00.000Z"));
	const { sqlite, request } = createDatabase();
	t.after(() => sqlite.close());
	for (const [query, expected] of [
		["period=7d", 7],
		["period=30d", 30],
		["period=custom&start=2026-10-09&end=2026-10-09", 1],
	] as const) {
		const response = await request(query);
		const { data } = (await response.json()) as { data: AdminDashboardStats };
		assert.equal(response.status, 200);
		assert.equal(data.metrics.searches.points.length, expected);
		assert.equal(data.metrics.searches.points.at(-1)?.date, "2026-10-08T16:00:00.000Z");
	}
});

test("paid-user snapshot matches active entitlement and excludes expired one-time packages", async (t) => {
	t.mock.method(Date, "now", () => NOW);
	const { sqlite, request } = createDatabase();
	t.after(() => sqlite.close());
	for (const [id, plan, status, payment, end] of [
		["pro", "pro", "active", "subscription", "2026-10-20T00:00:00Z"],
		["enterprise", "enterprise", "active", "subscription", "2026-10-20T00:00:00Z"],
		["one-time", "pro", "active", "one_time", "2026-10-20 00:00:00"],
		["expired", "pro", "active", "one_time", "2026-10-08T00:00:00Z"],
		["canceled", "pro", "canceled", "subscription", "2026-10-20T00:00:00Z"],
		["past-due", "pro", "past_due", "subscription", "2026-10-20T00:00:00Z"],
		["free", "hobby", "active", "subscription", null],
	] as const) {
		insertUser(sqlite, id, "2025-01-01T00:00:00Z");
		sqlite
			.prepare(
				"INSERT INTO user_subscriptions (user_id, plan_type, status, payment_type, current_period_end) VALUES (?, ?, ?, ?, ?)",
			)
			.run(id, plan, status, payment, end);
	}
	for (const query of ["period=7d", "period=custom&start=2026-01-01&end=2026-01-01"]) {
		const response = await request(query);
		const { data } = (await response.json()) as { data: AdminDashboardStats };
		assert.deepEqual(data.subscriptions, { total: 3, pro: 2, enterprise: 1 });
	}
});

test("database failures return an error rather than fabricated zero statistics", async () => {
	const response = await app.request(
		"/stats",
		{ headers: { "X-Admin-Password": "test-admin" } },
		{
			ADMIN_PASSWORD: "test-admin",
			DB: {
				prepare: () => {
					throw new Error("private database details");
				},
			} as unknown as D1Database,
		},
	);
	assert.equal(response.status, 500);
	const body = (await response.json()) as { success: boolean; data?: unknown };
	assert.equal(body.success, false);
	assert.equal(body.data, undefined);
	assert.doesNotMatch(JSON.stringify(body), /private database details/);
});

test("cancelled calls appear in their own admin outcome and bucket", async (t) => {
	const { sqlite, request } = createDatabase();
	t.after(() => sqlite.close());
	sqlite.exec(
		"INSERT INTO fetch_logs (user_id,requested_url,actual_url,status_code,outcome,error_code,created_at) VALUES ('reader','test','test',499,'cancelled','REQUEST_CANCELLED',datetime('now'))",
	);
	const response = await request("period=7d");
	assert.equal(response.status, 200);
	const { data } = (await response.json()) as { data: AdminDashboardStats };
	assert.equal(data.metrics.fetches.outcomes?.cancelled, 1);
	assert.equal(data.metrics.fetches.outcomes?.failed, 0);
	assert.equal(
		data.metrics.fetches.points.reduce((n, p) => n + (p.cancelled || 0), 0),
		1,
	);
});

test("channel comparison retains all sources while request filters preserve shared account totals", async (t) => {
	t.mock.method(Date, "now", () => NOW);
	const { sqlite, request } = createDatabase();
	t.after(() => sqlite.close());
	insertUser(sqlite, "reader", "2026-10-08T05:00:00Z");
	sqlite.exec(
		"INSERT INTO user_subscriptions(user_id,plan_type,status) VALUES('reader','pro','active')",
	);
	for (const [table, date, status, channel] of [
		["search_logs", "2026-10-08T04:15:00Z", 200, "mcp"],
		["fetch_logs", "2026-10-09T03:30:00Z", 500, "mcp"],
		["search_logs", "2026-10-08 17:00:00", 429, "cli"],
		["fetch_logs", "2026-10-09T01:30:00Z", 404, "cli"],
		["search_logs", "2026-10-09T01:00:00Z", 200, "unknown"],
		["search_logs", "2026-10-08T04:14:59.999Z", 200, "mcp"],
		["search_logs", "2026-10-09T04:15:00Z", 200, "cli"],
	] as const)
		insertLog(sqlite, table, date, status, "reader", channel);
	sqlite
		.prepare(
			"INSERT INTO browse_logs(user_id,channel,requested_url,result_count,status_code,outcome,created_at) VALUES ('reader','cli','https://developer.apple.com/documentation/swiftui',5,200,'success','2026-10-08T18:00:00Z')",
		)
		.run();
	const { data: all } = (await (await request("period=24h")).json()) as {
		data: AdminDashboardStats;
	};
	assert.deepEqual(
		Object.fromEntries(Object.entries(all.channels).map(([key, metric]) => [key, metric.total])),
		{ mcp: 2, cli: 3, unknown: 1 },
	);
	assert.equal(all.metrics.searches.total + all.metrics.fetches.total, 5);
	assert.equal(all.metrics.browses.total, 1);
	assert.equal(all.metrics.active_users.total, 1);
	for (const [channel, searches, fetches] of [
		["mcp", 1, 1],
		["cli", 1, 1],
		["unknown", 1, 0],
	] as const) {
		const { data } = (await (await request(`period=24h&channel=${channel}`)).json()) as {
			data: AdminDashboardStats;
		};
		assert.equal(data.metrics.searches.total, searches);
		assert.equal(data.metrics.fetches.total, fetches);
		assert.equal(data.metrics.browses.total, channel === "cli" ? 1 : 0);
		assert.deepEqual(data.channels, all.channels);
		for (const metric of ["users", "active_users", "new_users", "cumulative_users"] as const)
			assert.deepEqual(data.metrics[metric], all.metrics[metric]);
		assert.deepEqual(data.subscriptions, all.subscriptions);
		for (const metric of Object.values(data.channels)) {
			assert.equal(
				metric.points.reduce((sum, point) => sum + point.count, 0),
				metric.total,
			);
			assert.deepEqual(
				metric.points.map((point) => point.date),
				data.metrics.searches.points.map((point) => point.date),
			);
		}
		if (channel === "cli") {
			assert.equal(data.metrics.searches.outcomes?.limited, 1);
			assert.equal(data.metrics.fetches.outcomes?.no_content, 1);
			assert.equal(data.metrics.fetches.outcomes?.failed, 0);
		}
	}
	const { data: custom } = (await (
		await request("period=custom&start=2026-10-09&end=2026-10-09&channel=mcp")
	).json()) as { data: AdminDashboardStats };
	assert.equal(custom.metrics.searches.total, 0);
	assert.equal(custom.metrics.fetches.total, 1);
	assert.equal(custom.channels.mcp.total, 1);
	assert.equal(custom.channels.cli.total, 3);
});

test("model costs preserve native currencies, coverage and the request channel", async (t) => {
	t.mock.method(Date, "now", () => NOW);
	const { sqlite, request } = createDatabase("6.81");
	t.after(() => sqlite.close());
	const insert = sqlite.prepare(
		`INSERT INTO model_usage_events (created_at, category, channel, currency, cost_nanos, cost_source)
		 VALUES (?, ?, ?, ?, ?, ?)`,
	);
	const first = "2026-10-07T16:00:00.000Z";
	insert.run(first, "jev", "mcp", "USD", 42, "estimated");
	sqlite
		.prepare(
			"INSERT INTO model_usage_events (created_at,category,model,channel,currency,cost_nanos,cost_source) VALUES (?, 'reranking','microsoft/microsoft-decision-1.1','cli','USD',126,'estimated')",
		)
		.run("2026-10-09T01:00:00.000Z");
	insert.run("2026-10-07T17:00:00.000Z", "jev", "mcp", "USD", 42, "estimated");
	insert.run("2026-10-08T01:00:00.000Z", "embedding", "cli", "CNY", 140, "estimated");
	insert.run("2026-10-08T03:00:00.000Z", "embedding", null, "USD", 20, "estimated");
	insert.run("2026-10-09T01:00:00.000Z", "reranking", "mcp", "USD", 0, "reported");
	insert.run("2026-10-09T02:00:00.000Z", "jev", "mcp", null, null, null);
	insert.run(new Date(NOW).toISOString(), "jev", "mcp", "USD", 999, "estimated");
	const { data } = (await (await request()).json()) as { data: AdminDashboardStats };
	const { currencies, categories, first_recorded_at } = data.model_costs;
	assert.equal(data.model_costs.exchange_rate, 6.81);
	assert.equal(first_recorded_at, first);
	assert.deepEqual(categories.jev, { attempts: 3, unpriced_attempts: 1 });
	assert.deepEqual(categories.microsoft_decision, { attempts: 1, unpriced_attempts: 0 });
	assert.equal(currencies.USD?.categories.microsoft_decision.total_nanos, 126);
	assert.equal(currencies.USD?.total_nanos, 230);
	assert.equal(currencies.CNY?.total_nanos, 140);
	assert.equal(currencies.USD?.categories.reranking.priced_attempts, 1);
	assert.equal(currencies.USD?.categories.reranking.total_nanos, 0);
	assert.deepEqual(currencies.USD?.categories.jev.points.slice(-3), [
		{ date: "2026-10-06T16:00:00.000Z", count: null },
		{ date: first, count: 84 },
		{ date: "2026-10-08T16:00:00.000Z", count: 0 },
	]);
	const { data: filtered } = (await (await request("channel=mcp")).json()) as {
		data: AdminDashboardStats;
	};
	assert.equal(filtered.model_costs.currencies.USD?.total_nanos, 84);
	assert.equal(filtered.model_costs.currencies.CNY, undefined);
	assert.equal(filtered.model_costs.categories.embedding.attempts, 0);
});

test("billing counts distinct payers, preserves currency and exact payment windows", async (t) => {
	t.mock.method(Date, "now", () => NOW);
	const { sqlite, request } = createDatabase();
	t.after(() => sqlite.close());
	const insert = sqlite.prepare("INSERT INTO subscription_receipts VALUES(?,?,?,?,?,?)");
	insert.run("in_new", "user:a", "subscription_create", "USD", 100, "2026-10-08T04:15:00.000Z");
	insert.run("in_renew1", "user:a", "subscription_cycle", "USD", 100, "2026-10-08T05:15:00.000Z");
	insert.run("in_renew2", "user:a", "subscription_cycle", "USD", 100, "2026-10-09T03:15:00.000Z");
	insert.run("in_cny", "user:b", "subscription_create", "CNY", 700, "2026-10-09T03:15:00.000Z");
	insert.run(
		"in_boundary",
		"user:c",
		"subscription_create",
		"USD",
		999,
		"2026-10-09T04:15:00.000Z",
	);
	let { data } = await (await request("period=24h&channel=cli")).json();
	assert.equal(data.billing.history_complete, false);
	assert.equal(data.billing.new_subscribers.total, 2);
	assert.equal(data.billing.renewing_subscribers.total, 1);
	assert.equal(data.billing.receipts.USD.total, 300);
	assert.equal(data.billing.receipts.CNY.total, 700);
	assert.equal(
		data.billing.receipts.USD.points.reduce(
			(sum: number, p: { count: number }) => sum + p.count,
			0,
		),
		300,
	);
	sqlite.exec("INSERT INTO billing_history_sync VALUES(1,datetime('now'))");
	({ data } = await (await request("period=24h")).json());
	assert.equal(data.billing.history_complete, true);
});
