// Local-only UI fixture: uses real admin routes and an isolated in-memory database.
// Run after pnpm build: node --import tsx ops/ui/admin-fixture.mjs

import { readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import Stripe from "stripe";
import app from "../../worker/api/routes/admin/index.ts";

const sql = new DatabaseSync(":memory:");
for (const file of readdirSync(new URL("../../migrations/", import.meta.url))
	.filter((f) => f.endsWith(".sql"))
	.sort())
	sql.exec(readFileSync(new URL(`../../migrations/${file}`, import.meta.url), "utf8"));
const insert = sql.prepare(
	"INSERT INTO fetch_logs(id,user_id,requested_url,actual_url,response_time_ms,status_code,outcome,error_code,created_at,country_code,content_source,provider,upstream_status,cache_hit,channel) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,'mcp')",
);
const longUrl = `https://developer.apple.com/documentation/${"x".repeat(2048)}`.slice(0, 2048);
insert.run(
	"long-url",
	"fixture-user",
	longUrl,
	longUrl,
	1600,
	502,
	"failed",
	"ACCESS_BLOCKED",
	"2026-11-03T02:15:00Z",
	"SG",
	"apple",
	"firecrawl",
	403,
	0,
);
insert.run(
	"redirect",
	"fixture-user",
	"https://developer.apple.com/old",
	"https://developer.apple.com/documentation/swiftui",
	0,
	200,
	"degraded",
	"LIVE_READ_FALLBACK",
	"2026-11-03 02:14:00.000Z",
	"US",
	"apple",
	"apple_json",
	200,
	1,
);
insert.run(
	"cancel",
	"fixture-user",
	"https://example.com/cancel",
	"https://example.com/cancel",
	30,
	499,
	"cancelled",
	"REQUEST_CANCELLED",
	"2026-11-03T02:13:00Z",
	null,
	null,
	null,
	null,
	0,
);
for (let i = 0; i < 53; i++)
	insert.run(
		`row-${i}`,
		"fixture-user",
		`https://example.com/page/${i}`,
		`https://example.com/page/${i}`,
		i,
		200,
		"success",
		null,
		"2026-11-02T01:00:00Z",
		"US",
		"third_party",
		"firecrawl",
		200,
		0,
	);
const query = `SwiftUI ${"navigation ".repeat(900)}`;
sql
	.prepare(
		"INSERT INTO search_logs(id,user_id,requested_query,actual_query,result_count,response_time_ms,status_code,outcome,created_at,country_code,channel) VALUES(?,?,?,?,?,?,?,?,?,?,'mcp')",
	)
	.run(
		"long-query",
		"fixture-user",
		query,
		query,
		4,
		0,
		200,
		"success",
		"2026-11-03T02:15:00Z",
		"SG",
	);
// Recent source-labelled activity for the dashboard and its log drill-downs.
const fixtureNow = Date.now();
for (const id of ["channel-reader", "channel-reader-two"]) {
	sql
		.prepare("INSERT INTO users(id,email,name,created_at,updated_at) VALUES(?,?,?,?,?)")
		.run(
			id,
			`${id}@example.invalid`,
			id === "channel-reader" ? "林舟" : "Maya Chen",
			new Date(fixtureNow - 5 * 86400000).toISOString(),
			new Date(fixtureNow).toISOString(),
		);
}
sql.exec(
	"INSERT INTO user_subscriptions(user_id,plan_type,status,billing_interval) VALUES('channel-reader','pro','active','week')",
);
for (let day = 0; day < 7; day++) {
	const created = new Date(fixtureNow - day * 86400000 - 60000).toISOString();
	for (const channel of ["mcp", "cli"]) {
		for (let call = 0; call < (7 - day) * (channel === "mcp" ? 3 : 1); call++) {
			const kind = call % 2 ? "fetch" : "search";
			const columns =
				kind === "fetch" ? "requested_url,actual_url" : "requested_query,actual_query";
			const value =
				kind === "fetch"
					? "https://developer.apple.com/documentation/swiftui"
					: "SwiftUI navigation";
			sql
				.prepare(
					`INSERT INTO ${kind}_logs(user_id,${columns},channel,outcome,response_time_ms,created_at) VALUES(?,?,?,?,?,?,?)`,
				)
				.run(
					call % 3 ? "channel-reader" : "channel-reader-two",
					value,
					value,
					channel,
					call % 13 === 0 ? "limited" : "success",
					120 + call,
					created,
				);
		}
	}
}
sql.prepare("INSERT INTO billing_history_sync VALUES(1,?)").run(new Date().toISOString());
for (let day = 0; day < 7; day++) {
	for (let receipt = 0; receipt < 8 - day; receipt++)
		sql
			.prepare("INSERT INTO subscription_receipts VALUES(?,?,?,?,?,?)")
			.run(
				`invoice-${day}-${receipt}`,
				`user:reader-${receipt}`,
				receipt % 3 === 0 ? "subscription_create" : "subscription_cycle",
				"USD",
				receipt % 2 ? 100 : 400,
				new Date(fixtureNow - day * 86400000 - 60000).toISOString(),
			);
}
sql
	.prepare(
		"INSERT INTO fetch_logs(user_id,requested_url,actual_url,outcome,channel) VALUES(?,?,?,?,'mcp')",
	)
	.run(
		"anon_203.0.113.17",
		"https://developer.apple.com/documentation/swiftui",
		"https://developer.apple.com/documentation/swiftui",
		"success",
	);
if (process.env.ADMIN_FIXTURE_BILLING_PENDING) sql.exec("DELETE FROM billing_history_sync");
Stripe.resources.Invoices.prototype.list = async () => {
	console.log("Fixture: Stripe invoice import requested");
	if (process.env.ADMIN_FIXTURE_BILLING_PENDING === "error")
		throw new Error("Fixture Stripe unavailable");
	return { data: [], has_more: false };
};
const DB = {
	prepare(text) {
		let values = [];
		return {
			bind(...args) {
				values = args;
				return this;
			},
			async run() {
				sql.prepare(text).run(...values);
				return { success: true };
			},
			async first() {
				return sql.prepare(text).get(...values) ?? null;
			},
			async all() {
				return { success: true, results: sql.prepare(text).all(...values) };
			},
		};
	},
	async batch(statements) {
		return Promise.all(statements.map((s) => s.all()));
	},
};
const root = resolve("dist/client");
const mime = {
	".html": "text/html",
	".js": "text/javascript",
	".css": "text/css",
	".svg": "image/svg+xml",
	".png": "image/png",
	".woff2": "font/woff2",
	".ico": "image/x-icon",
};
const server = createServer(async (req, res) => {
	try {
		const url = new URL(req.url, "http://127.0.0.1");
		if (url.pathname.startsWith("/api/admin")) {
			if (url.searchParams.get("q") === "slow") await new Promise((r) => setTimeout(r, 500));
			const chunks = [];
			for await (const chunk of req) chunks.push(chunk);
			const response = await app.request(
				url.pathname.replace("/api/admin", "") + url.search,
				{
					method: req.method,
					headers: req.headers,
					...(chunks.length ? { body: Buffer.concat(chunks).toString() } : {}),
				},
				{ DB, ADMIN_PASSWORD: "local-admin-test", STRIPE_SECRET_KEY: "sk_live_local_fixture" },
			);
			res.writeHead(response.status, Object.fromEntries(response.headers));
			res.end(Buffer.from(await response.arrayBuffer()));
			return;
		}
		if (url.pathname.startsWith("/api/")) {
			res.writeHead(200, { "content-type": "application/json" });
			res.end(JSON.stringify({ success: true, data: {} }));
			return;
		}
		const path = resolve(root, `.${url.pathname}`);
		const asset = path.startsWith(`${root}/`) && extname(path) ? path : resolve(root, "index.html");
		res.writeHead(200, {
			"content-type": mime[extname(asset)] || "application/octet-stream",
			"cache-control": "no-store",
		});
		res.end(readFileSync(asset));
	} catch (error) {
		console.error(error.message);
		res.writeHead(500);
		res.end("Fixture request failed");
	}
});
const port = Number(process.env.ADMIN_FIXTURE_PORT || 4399);
server.listen(port, "127.0.0.1", () =>
	console.log(`Admin fixture: http://127.0.0.1:${port}/admin; password: local-admin-test`),
);
for (const signal of ["SIGINT", "SIGTERM"])
	process.on(signal, () =>
		server.close(() => {
			sql.close();
			process.exit(0);
		}),
	);
