import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import postgres from "postgres";
import { DatabaseService } from "./database.js";
import type { StoredWebPage } from "./page-reader.js";

test("PostgreSQL cache expiry, alias deduplication, capacity, budget races and indexing admission", {
	skip:
		!process.env.TEST_DATABASE_URL && "Set TEST_DATABASE_URL to run PostgreSQL integration tests",
}, async () => {
	const target = new URL(process.env.TEST_DATABASE_URL!);
	const schema = `retrieval_test_${randomUUID().replaceAll("-", "")}`;
	const admin = postgres(target.toString(), { max: 1, onnotice: () => {} });
	await admin`CREATE SCHEMA ${admin(schema)}`;
	const sql = postgres(target.toString(), {
		max: 5,
		connection: { search_path: schema },
		onnotice: () => {},
	});
	const db = new DatabaseService({
		RAG_DB_HOST: target.hostname,
		RAG_DB_PORT: Number(target.port || 5432),
		RAG_DB_USER: decodeURIComponent(target.username),
		RAG_DB_PASSWORD: decodeURIComponent(target.password),
		RAG_DB_DATABASE: target.pathname.slice(1),
		RAG_DB_SSLMODE: "disable",
	});
	// A private test schema keeps both production tables and other integration tests untouched.
	Object.assign(db, { sql });
	const page: StoredWebPage = {
		url: "https://docs.example.com/new",
		title: "Title",
		content: "Content",
		provider: "firecrawl",
		source: "third_party",
		status: 200,
	};
	try {
		const ddl = readFileSync(
			new URL("../../ops/server/postgresql_web_retrieval.sql", import.meta.url),
			"utf8",
		);
		const connection = await sql.reserve();
		try {
			await connection.unsafe(
				ddl.replace(
					/GRANT SELECT, INSERT, UPDATE, DELETE\s+ON web_page_cache, web_page_aliases, web_fetch_budget TO apple_rag_user;/,
					"",
				),
			);
		} finally {
			await connection.release();
		}
		await sql`CREATE TABLE pages (id uuid DEFAULT gen_random_uuid(), url text UNIQUE, title text, content text DEFAULT '', collect_count integer NOT NULL)`;
		await db.cachePage("https://docs.example.com/old", page);
		assert.deepEqual(await db.getCachedPage("https://docs.example.com/old"), page);
		assert.equal((await sql`SELECT count(*) FROM web_page_cache`)[0].count, "1");
		await sql`UPDATE web_page_cache SET expires_at = now() - interval '1 second'`;
		assert.equal(await db.getCachedPage(page.url), null);
		await db.cachePage(page.url, { ...page, status: 404, content: "" });
		const [negative] =
			await sql`SELECT extract(epoch FROM expires_at - now()) AS seconds FROM web_page_cache`;
		assert.ok(Number(negative.seconds) > 290 && Number(negative.seconds) <= 300);
		await sql`INSERT INTO web_page_cache (url,result,expires_at)
			SELECT 'https://docs.example.com/' || i, '{}'::jsonb, now() + interval '1 day' FROM generate_series(1, 501) i`;
		await db.cachePage(page.url, page);
		assert.equal((await sql`SELECT count(*) FROM web_page_cache`)[0].count, "500");
		assert.equal(
			(
				await sql`SELECT count(*) FROM web_page_aliases a LEFT JOIN web_page_cache p ON p.url = a.canonical_url WHERE p.url IS NULL`
			)[0].count,
			"0",
		);
		const attempts = await Promise.all(Array.from({ length: 20 }, () => db.reserveWebFetch(3)));
		assert.equal(attempts.filter(Boolean).length, 3);
		assert.equal((await sql`SELECT attempts FROM web_fetch_budget`)[0].attempts, 3);
		assert.equal(await db.reserveWebFetch(0), false);
		await sql`INSERT INTO pages(url,collect_count,content) VALUES ('https://developer.apple.com/documentation/existing',157,'Existing')`;
		await db.enqueuePage("https://developer.apple.com/documentation/new");
		await db.enqueuePage("https://developer.apple.com/documentation/new");
		const [queued] =
			await sql`SELECT collect_count,content FROM pages WHERE url = 'https://developer.apple.com/documentation/new'`;
		assert.equal(queued.collect_count, 156);
		assert.equal(queued.content, "");
		assert.equal((await sql`SELECT count(*) FROM pages`)[0].count, "2");
	} finally {
		await db.close();
		await admin`DROP SCHEMA ${admin(schema)} CASCADE`;
		await admin.end();
	}
});
