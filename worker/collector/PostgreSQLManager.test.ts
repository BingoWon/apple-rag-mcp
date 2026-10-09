import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { COLLECTOR_CONNECTION_PARAMETERS, PostgreSQLManager } from "./PostgreSQLManager.js";
import { logger } from "./utils/logger.js";

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

test("collector database operations remain safe under concurrency and interrupted connections", {
	skip:
		!process.env.TEST_DATABASE_URL && "Set TEST_DATABASE_URL to run PostgreSQL integration tests",
	timeout: 120_000,
}, async (t) => {
	const schema =
		process.env.TEST_DATABASE_SCHEMA ?? `collector_test_${randomUUID().replaceAll("-", "")}`;
	assert.match(schema, /^collector_test_[a-z0-9_]+$/);
	const clients: postgres.Sql[] = [];
	const connect = (parameters: Record<string, string | number> = {}) => {
		const client = postgres(process.env.TEST_DATABASE_URL!, {
			max: 1,
			onnotice: () => {},
			connection: {
				...COLLECTOR_CONNECTION_PARAMETERS,
				...parameters,
				application_name: "collector-integration-test",
				search_path: schema,
			},
		});
		clients.push(client);
		return client;
	};
	const sql = connect();
	let ownsFixture = false;
	t.after(async () => {
		await Promise.all(clients.map((client) => client.end({ timeout: 0 })));
		if (!ownsFixture) return;
		const cleanup = postgres(process.env.TEST_DATABASE_URL!, { max: 1, onnotice: () => {} });
		try {
			await cleanup`DROP SCHEMA ${cleanup(schema)} CASCADE`;
		} finally {
			await cleanup.end({ timeout: 0 });
		}
	});
	if (!process.env.TEST_DATABASE_SCHEMA) {
		await sql`CREATE SCHEMA ${sql(schema)}`;
	}
	const [tables] = await sql`SELECT count(*)::integer AS count FROM pg_tables
		WHERE schemaname = ${schema}`;
	assert.equal(tables.count, 0, "The supplied test schema must be empty");
	ownsFixture = true;
	await sql`CREATE TABLE ${sql(schema)}.pages (
		id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
		url text NOT NULL UNIQUE,
		raw_json text,
		title text,
		content text NOT NULL DEFAULT '',
		collect_count integer NOT NULL DEFAULT 0,
		created_at timestamptz NOT NULL DEFAULT now(),
		updated_at timestamptz
	)`;
	await sql`CREATE UNIQUE INDEX idx_pages_url_casefold ON pages (lower(url))
		WHERE url LIKE 'https://developer.apple.com/%'`;
	await sql`CREATE INDEX idx_pages_collection_queue ON pages (
		collect_count,
		(CASE WHEN content IS NULL OR content = '' THEN 0 ELSE 1 END),
		(CASE WHEN title IS NULL OR title = '' THEN 0 ELSE 1 END),
		url, id
	) WHERE url LIKE 'https://developer.apple.com/%'`;
	const manager = new PostgreSQLManager(sql);
	const observer = connect();
	const prefix = "https://developer.apple.com/documentation/collector-test/";

	async function hold(
		client: postgres.Sql,
		operation: (transaction: postgres.TransactionSql) => PromiseLike<unknown>,
	) {
		let ready!: () => void;
		let release!: () => void;
		const started = new Promise<void>((resolve) => {
			ready = resolve;
		});
		const resume = new Promise<void>((resolve) => {
			release = resolve;
		});
		const done = client
			.begin(async (transaction) => {
				await operation(transaction);
				ready();
				await resume;
			})
			.then(
				() => null,
				(error: unknown) => error,
			);
		await Promise.race([
			started,
			done.then((error) => {
				throw error ?? new Error("Transaction ended before taking its lock");
			}),
		]);
		return { release, done };
	}

	await t.test("collector session settings are accepted by the server", async () => {
		const [settings] = await sql`SELECT current_setting('statement_timeout') AS statement_timeout,
			current_setting('lock_timeout') AS lock_timeout,
			current_setting('tcp_user_timeout')::integer AS tcp_user_timeout,
			current_setting('client_connection_check_interval') AS client_connection_check_interval`;
		assert.deepEqual(settings, {
			statement_timeout: "2min",
			lock_timeout: "1min",
			tcp_user_timeout: 60_000,
			client_connection_check_interval: "1s",
		});
	});

	await t.test(
		"atomic claims preserve priority, skip held rows and return no old raw JSON",
		async () => {
			await sql`INSERT INTO pages (url, title, content, raw_json, collect_count) VALUES
			(${`${prefix}a-empty`}, NULL, '', repeat('large unused JSON', 10000), 157),
			(${`${prefix}b-empty`}, 'B', '', repeat('large unused JSON', 10000), 157),
			(${`${prefix}c-title`}, NULL, 'Content C', repeat('large unused JSON', 10000), 157),
			(${`${prefix}d-full`}, 'D', 'Content D', repeat('large unused JSON', 10000), 157),
			(${`${prefix}e-full`}, 'E', 'Content E', repeat('large unused JSON', 10000), 157),
			(${`${prefix}later`}, 'Later', '', NULL, 160),
			('https://example.com/other', NULL, '', NULL, 0)`;
			const blocker = connect();
			const held = await hold(
				blocker,
				(transaction) =>
					transaction`SELECT id FROM pages WHERE url = ${`${prefix}a-empty`} FOR UPDATE`,
			);
			try {
				const claimed = await manager.getBatchRecords(2);
				assert.deepEqual(claimed.map((record) => record.url).sort(), [
					`${prefix}b-empty`,
					`${prefix}c-title`,
				]);
				assert.ok(claimed.every((record) => record.collect_count === 158));
				assert.ok(claimed.every((record) => !("raw_json" in record)));
				assert.equal(
					claimed.find((record) => record.url === `${prefix}c-title`)?.content,
					"Content C",
				);
				const [stored] = await observer`SELECT octet_length(raw_json) AS size, collect_count
				FROM pages WHERE url = ${`${prefix}a-empty`}`;
				assert.equal(stored.size, 170_000);
				assert.equal(stored.collect_count, 157);
			} finally {
				held.release();
				assert.equal(await held.done, null);
			}
			await sql`TRUNCATE pages`;
			await sql`INSERT INTO pages (url, collect_count)
			SELECT ${prefix} || n::text, 157 FROM generate_series(1, 8) n`;
			const second = new PostgreSQLManager(connect());
			const [firstClaim, secondClaim] = await Promise.all([
				manager.getBatchRecords(2),
				second.getBatchRecords(2),
			]);
			assert.equal(firstClaim.length, 2);
			assert.equal(secondClaim.length, 2);
			assert.equal(new Set([...firstClaim, ...secondClaim].map((record) => record.id)).size, 4);
			const [counts] =
				await observer`SELECT count(*) FILTER (WHERE collect_count = 158)::integer AS claimed,
			count(*) FILTER (WHERE collect_count = 157)::integer AS remaining FROM pages`;
			assert.deepEqual(counts, { claimed: 4, remaining: 4 });
		},
	);

	await t.test("failed claim statements roll back every counter increment", async () => {
		await sql`CREATE FUNCTION fail_claim() RETURNS trigger LANGUAGE plpgsql AS
			'BEGIN RAISE EXCEPTION ''simulated claim failure''; END'`;
		await sql`CREATE TRIGGER fail_claim BEFORE UPDATE ON pages
			FOR EACH ROW EXECUTE FUNCTION fail_claim()`;
		try {
			const before = await observer`SELECT id, collect_count FROM pages ORDER BY id`;
			await assert.rejects(manager.getBatchRecords(2), /simulated claim failure/);
			assert.deepEqual(await observer`SELECT id, collect_count FROM pages ORDER BY id`, before);
		} finally {
			await sql`DROP TRIGGER fail_claim ON pages`;
		}
	});

	await t.test("existing URLs do not wait on an older collector's counter update", async () => {
		await sql`TRUNCATE pages`;
		const existing = `${prefix}WidgetKit/existing`;
		await sql`INSERT INTO pages (url, collect_count) VALUES (${existing}, 157)`;
		const held = await hold(
			connect(),
			(transaction) =>
				transaction`UPDATE pages SET collect_count = collect_count + 1 WHERE url = ${existing}`,
		);
		const impatient = connect({ lock_timeout: 100 });
		try {
			// Reproduce the original conflict wait before verifying the replacement query.
			await assert.rejects(
				impatient`INSERT INTO pages (url, collect_count)
					VALUES (${existing}, 156) ON CONFLICT DO NOTHING`,
				(error: unknown) => error instanceof postgres.PostgresError && error.code === "55P03",
			);
			const started = performance.now();
			assert.equal(
				await new PostgreSQLManager(impatient).batchInsertUrls([
					existing,
					existing.toLowerCase(),
					`${prefix}new`,
				]),
				1,
			);
			assert.ok(performance.now() - started < 2000);
			const [added] = await observer`SELECT collect_count FROM pages WHERE url = ${`${prefix}new`}`;
			assert.equal(added.collect_count, 156);
		} finally {
			held.release();
			assert.equal(await held.done, null);
		}
	});

	await t.test(
		"a raced new URL retries the rolled-back insert without losing its other URLs",
		async (subtest) => {
			await sql`TRUNCATE pages`;
			await sql`INSERT INTO pages (url, collect_count) VALUES (${`${prefix}seed`}, 157)`;
			const raced = `${prefix}raced`;
			const held = await hold(
				connect(),
				(transaction) => transaction`INSERT INTO pages (url, collect_count) VALUES (${raced}, 156)`,
			);
			const warning = subtest.mock.method(logger, "warn", () => {
				held.release();
			});
			try {
				const retried = new PostgreSQLManager(connect({ lock_timeout: 100 }));
				assert.equal(await retried.batchInsertUrls([`${prefix}other`, raced]), 1);
				assert.ok(warning.mock.callCount() >= 1);
				assert.equal(await held.done, null);
				const rows =
					await observer`SELECT url FROM pages WHERE url IN (${`${prefix}other`}, ${raced})
				ORDER BY url`;
				assert.deepEqual(
					rows.map((row) => row.url),
					[`${prefix}other`, raced],
				);
			} finally {
				held.release();
				await held.done;
			}
		},
	);

	await t.test("statement timeouts retry only the idempotent URL insertion", async (subtest) => {
		await sql`TRUNCATE pages`;
		await sql`INSERT INTO pages (url, collect_count) VALUES (${`${prefix}seed`}, 157)`;
		const raced = `${prefix}statement-timeout`;
		const held = await hold(
			connect(),
			(transaction) => transaction`INSERT INTO pages (url, collect_count) VALUES (${raced}, 156)`,
		);
		const warning = subtest.mock.method(logger, "warn", () => {
			held.release();
		});
		try {
			const retried = new PostgreSQLManager(
				connect({ lock_timeout: 1000, statement_timeout: 100 }),
			);
			assert.equal(await retried.batchInsertUrls([`${prefix}other`, raced]), 1);
			assert.ok(warning.mock.callCount() >= 1);
			assert.equal(await held.done, null);
			const [added] =
				await observer`SELECT count(*)::integer AS count FROM pages WHERE url = ${`${prefix}other`}`;
			assert.equal(added.count, 1);
		} finally {
			held.release();
			await held.done;
		}
	});

	await t.test("an administrator's query cancellation is not retried", async (subtest) => {
		await sql`TRUNCATE pages`;
		await sql`INSERT INTO pages (url, collect_count) VALUES (${`${prefix}seed`}, 157)`;
		const raced = `${prefix}cancelled`;
		const held = await hold(
			connect(),
			(transaction) => transaction`INSERT INTO pages (url, collect_count) VALUES (${raced}, 156)`,
		);
		const client = connect();
		const [backend] = await client`SELECT pg_backend_pid() AS pid`;
		const warning = subtest.mock.method(logger, "warn", () => {});
		const insertion = new PostgreSQLManager(client)
			.batchInsertUrls([`${prefix}not-committed`, raced])
			.then(
				() => null,
				(error: unknown) => error,
			);
		try {
			let waiting = false;
			const deadline = Date.now() + 10_000;
			while (Date.now() < deadline) {
				const [activity] =
					await observer`SELECT wait_event_type FROM pg_stat_activity WHERE pid = ${backend.pid}`;
				if (activity?.wait_event_type === "Lock") {
					waiting = true;
					break;
				}
			}
			assert.ok(waiting);
			await observer`SELECT pg_cancel_backend(${backend.pid})`;
			const error = await insertion;
			assert.ok(error instanceof postgres.PostgresError && error.code === "57014");
			assert.match(error.message, /user request/);
			assert.equal(warning.mock.callCount(), 0);
			const [added] =
				await observer`SELECT count(*)::integer AS count FROM pages WHERE url = ${`${prefix}not-committed`}`;
			assert.equal(added.count, 0);
		} finally {
			held.release();
			await held.done;
			await insertion;
		}
	});

	await t.test(
		"concurrent new URL inserts keep casefold uniqueness and non-Apple case sensitivity",
		async () => {
			await sql`TRUNCATE pages`;
			await sql`INSERT INTO pages (url, collect_count) VALUES (${`${prefix}seed`}, 157)`;
			const url = `${prefix}WidgetKit/race`;
			const [first, second] = await Promise.all([
				manager.batchInsertUrls([url]),
				new PostgreSQLManager(connect()).batchInsertUrls([url.toLowerCase()]),
			]);
			assert.equal(first + second, 1);
			const [count] = await observer`SELECT count(*)::integer AS count FROM pages
			WHERE lower(url) = lower(${url})`;
			assert.equal(count.count, 1);
			assert.equal(
				await manager.batchInsertUrls(["https://example.com/Path", "https://example.com/path"]),
				2,
			);
		},
	);

	await t.test(
		"opposite input orders keep the first spelling and recover from a deadlock victim",
		async (subtest) => {
			await sql`TRUNCATE pages`;
			await sql`INSERT INTO pages (url, collect_count) VALUES (${`${prefix}seed`}, 157)`;
			await sql`CREATE SEQUENCE deadlock_attempts`;
			await sql`CREATE FUNCTION fail_first_insert() RETURNS trigger LANGUAGE plpgsql AS
			'BEGIN
				IF nextval(''deadlock_attempts'') = 1 THEN
					RAISE EXCEPTION ''simulated external deadlock'' USING ERRCODE = ''40P01'';
				END IF;
				RETURN NEW;
			END'`;
			await sql`CREATE TRIGGER fail_first_insert BEFORE INSERT ON pages
			FOR EACH ROW EXECUTE FUNCTION fail_first_insert()`;
			const warning = subtest.mock.method(logger, "warn", () => {});
			try {
				const upper = `${prefix}WidgetKit/deadlock`;
				assert.equal(
					await manager.batchInsertUrls([`${prefix}deadlock-other`, upper, upper.toLowerCase()]),
					2,
				);
				assert.equal(warning.mock.callCount(), 1);
				const [spelling] = await observer`SELECT url FROM pages WHERE lower(url) = lower(${upper})`;
				assert.equal(spelling.url, upper);
			} finally {
				await sql`DROP TRIGGER fail_first_insert ON pages`;
			}
			const urls = Array.from({ length: 10 }, (_, index) => `${prefix}opposite-${index}`);
			const [forward, reverse] = await Promise.all([
				manager.batchInsertUrls(urls),
				new PostgreSQLManager(connect()).batchInsertUrls([...urls].reverse()),
			]);
			assert.equal(forward + reverse, urls.length);
			const rows = await observer`SELECT url FROM pages WHERE url = ANY(${urls}) ORDER BY url`;
			assert.deepEqual(
				rows.map((row) => row.url),
				[...urls].sort(),
			);
		},
	);

	await t.test(
		"closing an interrupted transaction rolls it back and releases its row lock",
		async () => {
			const client = connect();
			const url = `${prefix}seed`;
			let ready!: () => void;
			const started = new Promise<void>((resolve) => {
				ready = resolve;
			});
			const interrupted = client
				.begin(async (transaction) => {
					await transaction`UPDATE pages SET title = 'Uncommitted' WHERE url = ${url}`;
					ready();
					await transaction`SELECT pg_sleep(20)`;
				})
				.then(
					() => null,
					(error: unknown) => error,
				);
			await started;
			const start = performance.now();
			await new PostgreSQLManager(client).close();
			assert.ok(performance.now() - start < 2000);
			assert.ok((await interrupted) instanceof Error);
			await observer.begin(async (transaction) => {
				await transaction`SET LOCAL lock_timeout = '3s'`;
				const [row] = await transaction`SELECT title FROM pages WHERE url = ${url} FOR UPDATE`;
				assert.equal(row.title, null);
			});
		},
	);

	await t.test("closing after a successful write keeps its committed changes", async () => {
		const client = connect();
		const writer = new PostgreSQLManager(client);
		const url = `${prefix}committed`;
		assert.equal(await writer.batchInsertUrls([url]), 1);
		await writer.close();
		const [row] = await observer`SELECT url FROM pages WHERE url = ${url}`;
		assert.equal(row.url, url);
	});
});
