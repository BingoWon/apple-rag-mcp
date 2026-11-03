// Local-only UI fixture: uses real admin routes and an isolated in-memory database.
// Run after pnpm build: node --import tsx ops/ui/admin-fixture.mjs

import { readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import app from "../../worker/api/routes/admin/index.ts";

const sql = new DatabaseSync(":memory:");
for (const file of readdirSync(new URL("../../migrations/", import.meta.url))
	.filter((f) => f.endsWith(".sql"))
	.sort())
	sql.exec(readFileSync(new URL(`../../migrations/${file}`, import.meta.url), "utf8"));
const insert = sql.prepare(
	"INSERT INTO fetch_logs(id,user_id,requested_url,actual_url,response_time_ms,status_code,outcome,error_code,created_at,country_code,content_source,provider,upstream_status,cache_hit) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
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
		"INSERT INTO search_logs(id,user_id,requested_query,actual_query,result_count,response_time_ms,status_code,outcome,created_at,country_code) VALUES(?,?,?,?,?,?,?,?,?,?)",
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
const DB = {
	prepare(text) {
		let values = [];
		return {
			bind(...args) {
				values = args;
				return this;
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
			const response = await app.request(
				url.pathname.replace("/api/admin", "") + url.search,
				{ method: req.method, headers: req.headers },
				{ DB, ADMIN_PASSWORD: "local-admin-test" },
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
server.listen(4399, "127.0.0.1", () =>
	console.log("Admin fixture: http://127.0.0.1:4399/admin/fetch-logs; password: local-admin-test"),
);
for (const signal of ["SIGINT", "SIGTERM"])
	process.on(signal, () =>
		server.close(() => {
			sql.close();
			process.exit(0);
		}),
	);
