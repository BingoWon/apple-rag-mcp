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
	assert.equal(
		isTransientPostgresConnectionError(
			new Error("proxy request failed, cannot connect to the specified address"),
		),
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
	for (const code of ["23505", "55P03", "57014"]) {
		let calls = 0;
		const error = Object.assign(new Error("database operation failed"), { code });
		await assert.rejects(
			retryTransientPostgres(
				async () => {
					calls++;
					throw error;
				},
				{ sleep: async () => {} },
			),
			(candidate) => candidate === error,
		);
		assert.equal(calls, 1);
	}
});

test("an operation-specific retry policy stays bounded and preserves the final error", async () => {
	let calls = 0;
	const error = Object.assign(new Error("lock timeout"), { code: "55P03" });
	await assert.rejects(
		retryTransientPostgres(
			async () => {
				calls++;
				throw error;
			},
			{
				shouldRetry: (candidate) => candidate === error,
				sleep: async () => {},
			},
		),
		(candidate) => candidate === error,
	);
	assert.equal(calls, 3);
});
