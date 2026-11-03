import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import app from "./admin/index.js";

function setup() {
	const sql = new DatabaseSync(":memory:");
	const dir = new URL("../../../migrations/", import.meta.url);
	for (const file of readdirSync(dir)
		.filter((f) => f.endsWith(".sql"))
		.sort())
		sql.exec(readFileSync(new URL(file, dir), "utf8"));
	const db = {
		prepare: (query: string) => {
			let values: (string | number | null)[] = [];
			return {
				bind(...args: (string | number | null)[]) {
					values = args;
					return this;
				},
				async first() {
					return sql.prepare(query).get(...values) ?? null;
				},
				async all() {
					return { results: sql.prepare(query).all(...values), success: true };
				},
			};
		},
	};
	const request = (kind: string, query = "", authorized = true) =>
		app.request(
			`/${kind}-logs?${query}`,
			{ headers: authorized ? { "X-Admin-Password": "test-admin" } : {} },
			{ DB: db as unknown as D1Database, ADMIN_PASSWORD: "test-admin" },
		);
	return { sql, request };
}

test("admin log filtering uses the entire dataset, literal long text, UTC+8 and consistent counts", async (t) => {
	const { sql, request } = setup();
	t.after(() => sql.close());
	const insert = sql.prepare(
		"INSERT INTO fetch_logs (id,user_id,requested_url,actual_url,status_code,outcome,error_code,content_source,provider,cache_hit,created_at,response_time_ms) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
	);
	const long = `https://example.com/${"x".repeat(1800)}`;
	for (let i = 0; i < 55; i++)
		insert.run(
			`row-${i}`,
			"reader",
			`https://apple.example.com/${i}`,
			"canonical",
			200,
			"success",
			null,
			"apple",
			"index",
			0,
			"2026-11-03T00:00:00Z",
			10,
		);
	insert.run(
		"target",
		"reader",
		long,
		long,
		200,
		"degraded",
		"LIVE_READ_FALLBACK",
		"third_party",
		"firecrawl",
		1,
		"2026-11-02 16:00:00.000Z",
		0,
	);
	insert.run(
		"early",
		"reader",
		"before",
		"before",
		404,
		"no_content",
		"PAGE_NOT_FOUND",
		"apple",
		"apple_http",
		0,
		"2026-11-02T15:59:59Z",
		1,
	);
	insert.run(
		"late",
		"reader",
		"after",
		"after",
		404,
		"no_content",
		"PAGE_NOT_FOUND",
		"apple",
		"apple_http",
		0,
		"2026-11-03T16:00:00Z",
		1,
	);
	const q = new URLSearchParams({
		q: long,
		outcome: "degraded",
		source: "third_party",
		provider: "firecrawl",
		cache: "hit",
		reason: "LIVE_READ_FALLBACK",
		start: "2026-11-03",
		end: "2026-11-03",
	});
	const response = await request("fetch", q.toString());
	assert.equal(response.status, 200);
	const { data } = await response.json();
	assert.equal(data.total, 1);
	assert.equal(data.logs[0].id, "target");
	assert.equal(data.logs[0].requested_url, long);
	assert.equal(data.logs[0].response_time_ms, 0);
	assert.equal(data.hasMore, false);
	const day = await (
		await request("fetch", "start=2026-11-03&end=2026-11-03&limit=20&offset=40")
	).json();
	assert.equal(day.data.total, 56);
	assert.equal(day.data.logs.length, 16);
	assert.equal(day.data.hasMore, false);
	for (const value of ["%", "_", "' OR 1=1 --"]) {
		const r = await (await request("fetch", new URLSearchParams({ q: value }).toString())).json();
		assert.equal(r.data.total, 0);
	}
});

test("search log details retain full queries and reject invalid input before querying", async (t) => {
	const { sql, request } = setup();
	t.after(() => sql.close());
	const query = `SwiftUI ${"navigation ".repeat(300)}`;
	sql
		.prepare(
			"INSERT INTO search_logs(user_id,requested_query,actual_query,result_count,response_time_ms,outcome,created_at) VALUES (?,?,?,?,?,?,?)",
		)
		.run("reader", query, query, 0, 0, "no_content", "2026-11-03T02:00:00Z");
	const { data } = await (await request("search", "outcome=no_content")).json();
	assert.equal(data.logs[0].requested_query, query);
	assert.equal(data.logs[0].actual_query, query);
	assert.equal(data.logs[0].result_count, 0);
	assert.equal(data.logs[0].response_time_ms, 0);
	for (const invalid of [
		"offset=-1",
		"limit=0",
		"limit=1.5",
		"limit=101",
		"outcome=bogus",
		"start=invalid",
		"start=2026-11-04&end=2026-11-03",
		"provider=bogus",
		"cache=maybe",
	]) {
		assert.equal((await request("fetch", invalid)).status, 400, invalid);
	}
	assert.equal((await request("fetch", "", false)).status, 401);
});

test("both log views filter verified channel and expose references without raw credentials", async (t) => {
	const { sql, request } = setup();
	t.after(() => sql.close());
	for (const kind of ["search", "fetch"]) {
		const fields = kind === "search" ? "requested_query,actual_query" : "requested_url,actual_url";
		sql.exec(
			`INSERT INTO ${kind}_logs(user_id,${fields},channel,credential_id,request_id) VALUES('reader','test','test','cli','credential-id','request-id'),('reader','test','test','mcp','mcp-id','mcp-request')`,
		);
		const { data } = await (await request(kind, "channel=cli")).json();
		assert.equal(data.total, 1);
		assert.equal(data.logs[0].credential_id, "credential-id");
		assert.equal(data.logs[0].request_id, "request-id");
		assert(!("mcp_token" in data.logs[0]));
		assert.equal((await request(kind, "channel=spoof")).status, 400);
	}
});
