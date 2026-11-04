import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import app from "./admin/index";

test("admin tables resolve names without exposing user identifiers, emails or Stripe identifiers", async (t) => {
	const sql = new DatabaseSync(":memory:");
	t.after(() => sql.close());
	const dir = new URL("../../../migrations/", import.meta.url);
	for (const file of readdirSync(dir)
		.filter((f) => f.endsWith(".sql"))
		.sort())
		sql.exec(readFileSync(new URL(file, dir), "utf8"));
	sql.exec(`INSERT INTO users(id,email,name,created_at,updated_at) VALUES('reader','private@example.com','林舟',datetime('now'),datetime('now'));
 INSERT INTO user_subscriptions(user_id,stripe_customer_id,stripe_subscription_id,stripe_price_id) VALUES('reader','cus_private','sub_private','price_private');
 INSERT INTO mcp_tokens(id,user_id,name,mcp_token) VALUES('token','reader','Editor','fixture-token');
 INSERT INTO user_authorized_ips(user_id,name,ip_address) VALUES('reader','Office','203.0.113.1');
 INSERT INTO contact_messages(user_id,email,message) VALUES('reader','private@example.com','Hello');`);
	for (const kind of ["search", "fetch"]) {
		const fields = kind === "search" ? "requested_query,actual_query" : "requested_url,actual_url";
		for (const id of ["reader", "anon_203.0.113.17", "anon_203.0.113.18", "deleted-reader"])
			sql
				.prepare(`INSERT INTO ${kind}_logs(user_id,${fields}) VALUES(?,'SwiftUI','SwiftUI')`)
				.run(id);
	}
	const db = {
		prepare: (query: string) => {
			let args: unknown[] = [];
			return {
				bind(...values: unknown[]) {
					args = values;
					return this;
				},
				async first() {
					return sql.prepare(query).get(...(args as string[])) ?? null;
				},
				async all() {
					return { results: sql.prepare(query).all(...(args as string[])) };
				},
			};
		},
	} as unknown as D1Database;
	const request = async (path: string) => {
		const res = await app.request(
			path,
			{ headers: { "X-Admin-Password": "fixture" } },
			{ DB: db, ADMIN_PASSWORD: "fixture" },
		);
		assert.equal(res.status, 200, path);
		return (await res.json()).data;
	};
	for (const [path, key] of [
		["/user-subscriptions", "subscriptions"],
		["/mcp-tokens", "tokens"],
		["/authorized-ips", "ips"],
		["/contact-messages", "messages"],
	]) {
		const data = await request(path);
		assert.equal(data[key][0].user.name, "林舟");
		const serialized = JSON.stringify(data);
		for (const secret of [
			"private@example.com",
			"cus_private",
			"sub_private",
			"price_private",
			'"user_id"',
			'"user_email"',
		])
			assert.ok(!serialized.includes(secret), secret);
	}
	const search = await request("/search-logs");
	const fetch = await request("/fetch-logs");
	const anonymous = search.logs.filter(
		(row: { user: { kind: string } }) => row.user.kind === "anonymous",
	);
	assert.equal(anonymous.length, 2);
	assert.notEqual(anonymous[0].user.alias, anonymous[1].user.alias);
	assert.deepEqual(
		search.logs
			.map((row: { user: unknown }) => row.user)
			.sort((a: { alias: string }, b: { alias: string }) => a.alias.localeCompare(b.alias)),
		fetch.logs
			.map((row: { user: unknown }) => row.user)
			.sort((a: { alias: string }, b: { alias: string }) => a.alias.localeCompare(b.alias)),
	);
	assert.ok(search.logs.some((row: { user: { kind: string } }) => row.user.kind === "deleted"));
	assert.ok(!JSON.stringify(search).includes("anon_203.0.113"));
	assert.equal((await request(`/search-logs?q=${encodeURIComponent("林舟")}`)).total, 1);
	const users = await request("/users");
	assert.equal(users.users[0].email, "private@example.com");
	const messages = await request("/contact-messages");
	assert.equal(messages.messages[0].can_reply, true);
	assert.equal(messages.messages[0].has_email, true);
});
