import assert from "node:assert/strict";
import test from "node:test";
import { fixture } from "../../../packages/cli/test/fixture.js";
import { clientDetails, clientReport } from "../../../shared/client-usage.js";
import type { ToolKind } from "../../../shared/tool-activity.js";
import { operationContext } from "../../services/operation-context.js";
import { ToolCallLogger } from "../../services/tool-call-logger.js";
import admin from "./admin/index.js";

test("client counts reconcile across channels, labels, attempts and accounts at exact window boundaries", async (t) => {
	const f = await fixture();
	t.after(() => f.close());
	const env = { ...f.env, ADMIN_PASSWORD: "fixture-admin" };
	const get = (path: string) =>
		admin.request(`/clients${path}`, { headers: { "X-Admin-Password": "fixture-admin" } }, env);
	const now = Date.parse("2026-11-20T04:20:45Z");
	t.mock.method(Date, "now", () => now);
	function log(
		tool: ToolKind,
		channel: string,
		ua: string | null,
		opts: { user?: string; status?: number; date?: string; version?: string } = {},
	) {
		const input = tool === "search" ? "requested_query,actual_query" : "requested_url";
		f.sql
			.prepare(
				`INSERT INTO ${tool}_logs(${input},user_id,channel,client_name,client_version,status_code,outcome,created_at) VALUES(${tool === "search" ? "'q','q'" : "'url'"},?,?,?,?,?,'success',?)`,
			)
			.run(
				opts.user ?? "reader",
				channel,
				ua,
				opts.version ?? null,
				opts.status ?? 200,
				opts.date ?? "2026-11-20 04:20:44",
			);
	}
	assert.equal((await admin.request("/clients", {}, env)).status, 401);
	assert.equal((await admin.request("/clients/breakdown", {}, env)).status, 401);
	assert.equal((await get("?period=wrong")).status, 400);
	const report = async (period: string) =>
		clientReport.parse((await (await get(`?period=${period}`)).json()).data);
	assert.equal((await report("7d")).rows[0].calls, 0);
	log("search", "mcp", "opencode/latest/2.2.7/cli", { date: "2026-11-13 04:20:45" });
	log("browse", "mcp", "CLAUDE-CODE/2.1.327 (claude-vscode, agent-sdk/0.3.327)", { status: 429 });
	log("fetch", "mcp", "openai-mcp/1.0.0 (Codex)", { user: "anon_test", status: 502 });
	log("fetch", "cli", "apple-rag-cli/2.1.0", { version: "2.1.1" });
	log("browse", "cli", "curl/8.7.1", { user: "anon_test" });
	log("search", "mcp", "KitScout-LiveCheck/0.1 (health check)", { user: "anon_probe" });
	log("search", "mcp", "unmapped/1.0 (Cursor/4.0 secret@example.invalid)", { user: "removed" });
	log("search", "mcp", null, { date: "2026-11-13T04:20:44.999Z" });
	log("fetch", "mcp", "", { date: "bad-date" });
	log("browse", "mcp", "Cursor/4.0", { date: new Date(now).toISOString() });
	const week = await report("7d");
	assert.deepEqual(week.rows[0], {
		channel: null,
		family: null,
		calls: 7,
		accounts: 1,
		account_calls: 3,
		search: 3,
		browse: 2,
		fetch: 2,
		ok: 5,
		limited: 1,
	});
	assert.equal(
		week.rows.filter((r) => r.family === null && r.channel).reduce((n, r) => n + r.accounts, 0),
		2,
	);
	assert.deepEqual(
		week.rows
			.filter((r) => r.family)
			.map((r) => r.family)
			.sort(),
		["apple_cli", "claude", "codex", "http", "opencode", "probe", "unrecognized"],
	);
	assert.equal((await report("24h")).rows[0].calls, 6);
	assert.equal((await report("30d")).rows[0].calls, 8);
	assert.equal((await report("all")).rows.find((r) => r.family === "missing")?.calls, 2);
	const breakdown = async (family: string, channel: string, dimension: string, page = 1) => {
		const params = new URLSearchParams({
			period: "7d",
			end: week.end,
			family,
			channel,
			dimension,
			page: String(page),
		});
		const r = await get(`/breakdown?${params}`);
		assert.equal(r.status, 200);
		assert.match(r.headers.get("Cache-Control") ?? "", /no-store/);
		return clientDetails.parse((await r.json()).data);
	};
	assert.deepEqual((await breakdown("opencode", "mcp", "version")).rows, [
		{ label: null, version: "2.2.7", calls: 1 },
	]);
	assert.deepEqual((await breakdown("claude", "mcp", "environment")).rows, [
		{ label: "claude-vscode", version: null, calls: 1 },
	]);
	assert.equal((await breakdown("apple_cli", "cli", "version")).rows[0].version, "2.1.1");
	assert.equal(
		(await breakdown("probe", "mcp", "environment")).rows[0].label,
		"kitscout-livecheck",
	);
	assert.deepEqual((await breakdown("unrecognized", "mcp", "version")).rows, [
		{ label: null, version: null, calls: 1 },
	]);
	assert.equal((await breakdown("apple_cli", "mcp", "version")).total, 0);
	assert.deepEqual((await breakdown("unrecognized", "mcp", "environment")).rows, [
		{ label: "unmapped", version: null, calls: 1 },
	]);
	assert.equal(
		(await get("/breakdown?period=7d&end=2099-01-01T00:00:00Z&channel=mcp&family=codex")).status,
		400,
	);
	assert.equal(
		(await get(`/breakdown?period=7d&end=${week.end}&channel=mcp&family=codex&page=0`)).status,
		400,
	);
	for (let i = 0; i < 24; i++) log("browse", "mcp", `codex-mcp-client/2.0.${i}`);
	const first = await breakdown("codex", "mcp", "version"),
		second = await breakdown("codex", "mcp", "version", 2);
	assert.equal(first.total, 25);
	assert.equal(first.rows.length, 20);
	assert.equal(second.rows.length, 5);
	assert.equal(new Set([...first.rows, ...second.rows].map((r) => r.version)).size, 25);
	assert.deepEqual(await breakdown("codex", "mcp", "version", 3), { total: 25, rows: [] });
	// The header identifies the host, independently of transport UA and authorization.
	const writes: Promise<unknown>[] = [];
	const logger = new ToolCallLogger(f.env.DB, {
		waitUntil(p) {
			writes.push(p);
		},
	});
	for (const product of ["deepseek-harness", "workbuddy", "trae"]) {
		const req = new Request("https://mcp.apple-rag.com", {
			headers: { "X-Apple-RAG-Client": product, "User-Agent": "node/22.0.0" },
		});
		const ctx = operationContext({ isAuthenticated: false }, req, "mcp");
		assert.equal(
			operationContext({ isAuthenticated: false }, req, "cli").reportedClient,
			undefined,
		);
		logger.logBrowse({
			...ctx,
			userId: "anon_test",
			responseTimeMs: 1,
			outcome: "success",
			requestedUrl: "",
			resultCount: 1,
		});
	}
	await Promise.all(writes);
	// Use the fixture window for the newly inserted events.
	f.sql
		.prepare("UPDATE browse_logs SET created_at=? WHERE reported_client IS NOT NULL")
		.run("2026-11-20 04:20:44");
	log("search", "mcp", "dsh-mcp-client/0.0.1");
	log("fetch", "mcp", "trae-cn/3.0");
	log("search", "mcp", "WorkBuddy/1.0");
	const region = await report("7d");
	for (const family of ["deepseek-harness", "workbuddy", "trae"])
		assert.equal(region.rows.find((r) => r.family === family)?.calls, 2);
	assert.deepEqual(
		(await breakdown("workbuddy", "mcp", "version")).rows.map((r) => r.version).sort(),
		["1.0", null].sort(),
	);
	assert.equal(
		operationContext(
			{ isAuthenticated: false },
			new Request("https://example.com", { headers: { "X-Apple-RAG-Client": "untrusted name" } }),
			"mcp",
		).reportedClient,
		undefined,
	);
});
