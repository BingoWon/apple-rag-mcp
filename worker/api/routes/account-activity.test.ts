import assert from "node:assert/strict";
import test from "node:test";
import { fixture } from "../../../packages/cli/test/fixture.js";
import { TOOL_KINDS, type ToolActivity, type ToolKind } from "../../../shared/tool-activity.js";
import logs from "./usage-logs.js";
import users from "./users.js";

test("account activity and tool drill-downs share exact UTC+8 windows, include errors, and isolate users", async (t) => {
	const f = await fixture();
	t.after(() => f.close());
	const now = Date.parse("2026-11-19T09:15:00.000Z");
	t.mock.method(Date, "now", () => now);
	const h = { Authorization: "Bearer " + f.webToken };
	const at = (ms: number) => new Date(ms).toISOString();
	function add(kind: ToolKind, stamp: string, id = "reader", status = 200) {
		const cols = kind === "search" ? "requested_query,actual_query" : "requested_url";
		f.sql
			.prepare(
				`INSERT INTO ${kind}_logs(user_id,${cols},channel,status_code,outcome,created_at) VALUES(?,${kind === "search" ? "?,?" : "?"},'mcp',?,?,?)`,
			)
			.run(
				id,
				...(kind === "search" ? ["fixture", "fixture"] : ["fixture"]),
				status,
				status === 200 ? "success" : "limited",
				stamp,
			);
	}
	const windows = {
		"24h": now - 86400000,
		"7d": Date.parse("2026-11-12T16:00:00Z"),
		"30d": Date.parse("2026-10-20T16:00:00Z"),
	};
	for (const start of Object.values(windows)) {
		add("search", at(start - 1));
		add("browse", at(start), "reader", 429);
	}
	add("fetch", "2026-11-19 08:59:59");
	add("browse", at(now - 1));
	add("search", at(now));
	add("fetch", at(now - 1), "another-account");
	for (const [period, start] of Object.entries(windows)) {
		const res = await users.request("/usage/stats?period=" + period, { headers: h }, f.env);
		assert.equal(res.status, 200);
		const { data } = (await res.json()) as { data: ToolActivity };
		assert.equal(data.start, at(start));
		assert.equal(data.end, at(now));
		assert.equal(data.points.length, period === "24h" ? 25 : parseInt(period));
		assert.ok(data.points.some((p) => p.search + p.fetch + p.browse === 0));
		let total = 0;
		for (const kind of TOOL_KINDS) {
			const args = new URLSearchParams({ from: data.start, to: data.end, log_type: kind });
			const detail = await logs.request("/history?" + args, { headers: h }, f.env);
			assert.equal(detail.status, 200);
			const rows = (await detail.json()).data;
			assert.equal(rows.pagination.total, data.by_tool[kind]);
			assert.equal(
				data.by_tool[kind],
				data.points.reduce((s, p) => s + p[kind], 0),
			);
			assert.ok(
				rows.items.every((r: { created_at: string }) => {
					const n = Date.parse(
						r.created_at.includes("T") ? r.created_at : r.created_at.replace(" ", "T") + "Z",
					);
					return n >= start && n < now;
				}),
			);
			total += rows.pagination.total;
		}
		assert.equal(data.total, total);
	}
	const single = (
		await (await users.request("/usage/stats?period=24h", { headers: h }, f.env)).json()
	).data;
	assert.deepEqual(single.by_tool, { search: 0, fetch: 1, browse: 2 });
	assert.equal(single.total, 3);
	for (const query of [
		"from=" + at(now),
		"to=" + at(now),
		"from=" + at(now) + "&to=" + at(now - 1),
	])
		assert.equal((await logs.request("/history?" + query, { headers: h }, f.env)).status, 400);
	assert.equal((await users.request("/usage/stats", {}, f.env)).status, 401);
});
