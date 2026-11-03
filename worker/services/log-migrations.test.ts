import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const dir = new URL("../../migrations/", import.meta.url);
const load = (name: string) => readFileSync(new URL(name, dir), "utf8");

test("log migrations support the legacy production column order and recover only swapped dates", () => {
	const db = new DatabaseSync(":memory:");
	try {
		for (const file of readdirSync(dir)
			.filter((f) => f.endsWith(".sql") && f < "0007")
			.sort())
			db.exec(load(file));
		// The historical production table predates 0003's CREATE TABLE IF NOT EXISTS.
		db.exec(
			`CREATE TABLE legacy_fetch AS SELECT id,user_id,mcp_token,requested_url,actual_url,page_id,response_time_ms,status_code,error_code,ip_address,created_at,country_code,outcome,content_source,provider,upstream_status,cache_hit FROM fetch_logs; DROP TABLE fetch_logs; ALTER TABLE legacy_fetch RENAME TO fetch_logs;`,
		);
		db.exec(
			`INSERT INTO fetch_logs (id,user_id,requested_url,created_at,country_code,ip_address,outcome,cache_hit) VALUES ('legacy','reader','https://example.com','2026-11-03T01:00:00.000Z','ZA','203.0.113.1','success',0)`,
		);
		const original = db.prepare("SELECT * FROM fetch_logs").get();
		db.exec(load("0007_cancelled_tool_outcomes.sql"));
		assert.deepEqual({ ...db.prepare("SELECT * FROM fetch_logs").get() }, { ...original });
		// Reproduce the already-applied 0007 defect, alongside a new row and invalid input.
		db.exec(
			`UPDATE fetch_logs SET created_at=country_code,country_code=created_at WHERE id='legacy'; INSERT INTO fetch_logs (id,user_id,requested_url,created_at,country_code,outcome) VALUES ('new','reader','new','2026-11-03T02:00:00.000Z','SG','success'),('invalid','reader','invalid','not-a-date','US','invalid'),('null-country','reader','null-country',NULL,'2026-11-02 01:00:00','success');`,
		);
		const newRow = db.prepare("SELECT * FROM fetch_logs WHERE id='new'").get();
		db.exec(load("0008_repair_fetch_log_dates.sql"));
		assert.deepEqual(
			{ ...db.prepare("SELECT * FROM fetch_logs WHERE id='legacy'").get() },
			{ ...original },
		);
		assert.deepEqual(db.prepare("SELECT * FROM fetch_logs WHERE id='new'").get(), newRow);
		assert.equal(
			db.prepare("SELECT created_at FROM fetch_logs WHERE id='invalid'").get()?.created_at,
			"not-a-date",
		);
		assert.equal(
			db.prepare("SELECT country_code FROM fetch_logs WHERE id='null-country'").get()?.country_code,
			null,
		);
		db.exec(load("0008_repair_fetch_log_dates.sql"));
		assert.equal(db.prepare("SELECT count(*) AS n FROM fetch_logs").get()?.n, 4);
		assert.deepEqual(
			{ ...db.prepare("SELECT * FROM fetch_logs WHERE id='legacy'").get() },
			{ ...original },
		);
	} finally {
		db.close();
	}
});

test("CLI migration preserves rows, maps credential IDs and prevents old writers from restoring bearer secrets", () => {
	const db = new DatabaseSync(":memory:");
	try {
		for (const file of readdirSync(dir)
			.filter((f) => f.endsWith(".sql") && f < "0009")
			.sort())
			db.exec(load(file));
		db.exec(
			"INSERT INTO users(id,email,name,created_at,updated_at) VALUES('reader','reader@example.com','Reader',datetime('now'),datetime('now')); INSERT INTO mcp_tokens(id,user_id,name,mcp_token) VALUES('key-id','reader','Test','fixture-secret'); INSERT INTO search_logs(user_id,requested_query,actual_query,mcp_token) VALUES('reader','Swift','Swift','fixture-secret'); INSERT INTO fetch_logs(user_id,requested_url,mcp_token) VALUES('reader','https://example.com','fixture-secret');",
		);
		db.exec(load("0009_cli_authorization.sql"));
		for (const table of ["search_logs", "fetch_logs"]) {
			const row = db.prepare(`SELECT channel,credential_id,mcp_token FROM ${table}`).get();
			assert.deepEqual(
				{ ...row },
				{ channel: "unknown", credential_id: "key-id", mcp_token: null },
			);
		}
		db.exec(
			"INSERT INTO search_logs(user_id,requested_query,actual_query,mcp_token) VALUES('reader','Old worker','Old worker','fixture-secret')",
		);
		assert.equal(
			db.prepare("SELECT mcp_token FROM search_logs ORDER BY rowid DESC LIMIT 1").get()?.mcp_token,
			null,
		);
	} finally {
		db.close();
	}
});
