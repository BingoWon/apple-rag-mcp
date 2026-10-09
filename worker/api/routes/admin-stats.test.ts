import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { AdminDashboardStats } from "../../../src/types/index.js";
import app from "./admin/index.js";

const NOW = Date.parse("2026-10-09T04:15:00.000Z");

function createDatabase() {
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
) {
	const columns =
		table === "search_logs" ? "requested_query, actual_query" : "requested_url, actual_url";
	sqlite
		.prepare(
			`INSERT INTO ${table} (user_id, ${columns}, status_code, created_at) VALUES (?, ?, ?, ?, ?)`,
		)
		.run("anon_203.0.113.10", "test", "test", status, createdAt);
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
	assert.equal(data.start, "2026-10-02T16:00:00.000Z");
	assert.equal(data.end, new Date(NOW).toISOString());
	assert.equal(data.metrics.users.total, 2);
	assert.equal(data.metrics.tokens.total, 1);
	assert.equal(data.metrics.ips.total, 1);
	assert.equal(data.metrics.messages.total, 1);
	assert.equal(data.metrics.searches.total, 5);
	assert.equal(data.metrics.fetches.total, 2);
	assert.deepEqual(data.metrics.searches.outcomes, {
		success: 1,
		failed: 2,
		limited: 1,
		unknown: 1,
	});
	assert.deepEqual(data.metrics.fetches.outcomes, {
		success: 1,
		failed: 1,
		limited: 0,
		unknown: 0,
	});
	assert.equal(data.metrics.searches.points[0].count, 1);
	assert.equal(data.metrics.searches.points[2].count, 0);
	assert.equal(data.metrics.searches.points.at(-1)?.count, 3);
	for (const metric of Object.values(data.metrics)) {
		assert.equal(metric.points.length, 7);
		assert.equal(
			metric.total,
			metric.points.reduce((sum, point) => sum + point.count, 0),
		);
	}
	assert.equal(queries.length, 7);
	for (const table of ["search_logs", "fetch_logs"]) {
		const sql = queries.find((query) => query.includes(`FROM ${table}`))!;
		const plan = sqlite
			.prepare(`EXPLAIN QUERY PLAN ${sql}`)
			.all("2026-10-02", "2026-10-10", data.start, data.end);
		assert.ok(plan.some((row) => String(row.detail).includes(`idx_${table}_created_at`)));
	}
	assert.doesNotMatch(JSON.stringify(data), /anon_|test-token|example\.com|requested_query/);
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
