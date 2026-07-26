import assert from "node:assert/strict";
import test from "node:test";
import { isTransientPostgresConnectionError, retryTransientPostgres } from "./postgres-retry.ts";

test("recognizes transient PostgreSQL connection errors", () => {
	assert.equal(isTransientPostgresConnectionError({ code: "CONNECTION_CLOSED" }), true);
	assert.equal(isTransientPostgresConnectionError({ code: "08006" }), true);
	assert.equal(
		isTransientPostgresConnectionError(new Error("write CONNECTION_CLOSED 75.127.7.212:5432")),
		true,
	);
	assert.equal(isTransientPostgresConnectionError({ code: "23505" }), false);
});

test("retries transient failures and returns the successful result", async () => {
	let calls = 0;
	const attempts: number[] = [];

	const result = await retryTransientPostgres(
		async () => {
			calls++;
			if (calls < 3) {
				throw Object.assign(new Error("connection closed"), { code: "CONNECTION_CLOSED" });
			}
			return "ok";
		},
		{
			baseDelayMs: 1,
			sleep: async () => {},
			onRetry: ({ attempt }) => attempts.push(attempt),
		},
	);

	assert.equal(result, "ok");
	assert.equal(calls, 3);
	assert.deepEqual(attempts, [2, 3]);
});

test("does not retry non-transient PostgreSQL errors", async () => {
	let calls = 0;

	await assert.rejects(
		retryTransientPostgres(
			async () => {
				calls++;
				throw Object.assign(new Error("duplicate key"), { code: "23505" });
			},
			{
				sleep: async () => {},
			},
		),
		/duplicate key/,
	);

	assert.equal(calls, 1);
});
