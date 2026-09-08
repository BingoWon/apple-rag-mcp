import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";
import { PostgreSQLManager } from "./PostgreSQLManager.js";

test("skips exact and casefold URL conflicts without losing new URLs across batches", {
	skip:
		!process.env.TEST_DATABASE_URL && "Set TEST_DATABASE_URL to run PostgreSQL integration tests",
}, async () => {
	const sql = postgres(process.env.TEST_DATABASE_URL!, { max: 1 });
	try {
		await sql.begin(async (transaction) => {
			// Temporary tables and a restricted search path keep application tables untouched.
			await transaction`SET LOCAL search_path = pg_temp`;
			await transaction`CREATE TEMP TABLE pages (
					id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
					url text NOT NULL UNIQUE,
					collect_count integer NOT NULL DEFAULT 0,
					content text DEFAULT ''
				) ON COMMIT DROP`;
			await transaction`CREATE UNIQUE INDEX idx_pages_url_casefold ON pages (lower(url))
					WHERE url LIKE 'https://developer.apple.com/%'`;

			const existingUrl =
				"https://developer.apple.com/documentation/WidgetKit/building-widgets-using-widgetkit-and-swiftui";
			const [existing] = await transaction`INSERT INTO pages (url, collect_count, content)
					VALUES (${existingUrl}, 157, 'Existing content') RETURNING *`;
			const newUrls = Array.from(
				{ length: 1001 },
				(_, index) => `https://developer.apple.com/documentation/casefold-regression/${index}`,
			);
			const manager = new PostgreSQLManager(transaction as unknown as postgres.Sql);

			assert.equal(await manager.batchInsertUrls([]), 0);
			assert.equal(
				await manager.batchInsertUrls([
					existingUrl,
					existingUrl.toLowerCase(),
					...newUrls,
					newUrls[0],
					newUrls[0].replace("/casefold-regression/", "/Casefold-Regression/"),
				]),
				newUrls.length,
			);
			assert.equal(await manager.batchInsertUrls([existingUrl, existingUrl.toLowerCase()]), 0);
			assert.deepEqual(
				(await transaction`SELECT * FROM pages WHERE url = ${existingUrl}`)[0],
				existing,
			);
			const inserted =
				await transaction`SELECT url, collect_count FROM pages WHERE url <> ${existingUrl}`;
			assert.deepEqual(inserted.map((row) => row.url).sort(), [...newUrls].sort());
			assert.ok(inserted.every((row) => row.collect_count === 156));
		});
	} finally {
		await sql.end();
	}
});
