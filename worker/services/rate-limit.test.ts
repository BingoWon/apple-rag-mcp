import assert from "node:assert/strict";
import test from "node:test";
import { RateLimitService } from "./rate-limit.js";

class FakeStatement {
	private values: unknown[] = [];

	constructor(
		private sql: string,
		private counters: Map<string, number>,
	) {}

	bind(...values: unknown[]) {
		this.values = values;
		return this;
	}

	async first<T>(): Promise<T | null> {
		if (!this.sql.includes("INSERT INTO usage_counters")) {
			return null;
		}

		const [identifier, period, windowStart, , limit] = this.values;
		const key = `${identifier}:${period}:${windowStart}`;
		const count = this.counters.get(key) || 0;
		if (count >= Number(limit)) return null;

		const next = count + 1;
		this.counters.set(key, next);
		return { count: next } as T;
	}

	async run(): Promise<void> {
		if (!this.sql.includes("UPDATE usage_counters")) return;

		const [, identifier, period, windowStart] = this.values;
		const key = `${identifier}:${period}:${windowStart}`;
		this.counters.set(key, Math.max(0, (this.counters.get(key) || 0) - 1));
	}
}

class FakeD1 {
	readonly counters = new Map<string, number>();

	prepare(sql: string) {
		return new FakeStatement(sql, this.counters);
	}

	async batch(statements: FakeStatement[]) {
		await Promise.all(statements.map((statement) => statement.run()));
		return [];
	}
}

test("atomically enforces and refunds anonymous minute quotas", async () => {
	const db = new FakeD1();
	const service = new RateLimitService(db as never);
	const decisions = [];

	for (let index = 0; index < 3; index++) {
		decisions.push(await service.checkLimits("203.0.113.1", { isAuthenticated: false }));
	}

	assert.ok(decisions.every((decision) => decision.allowed));
	const limited = await service.checkLimits("203.0.113.1", { isAuthenticated: false });
	assert.equal(limited.allowed, false);
	assert.equal(limited.limitType, "minute");

	await service.refund(decisions[0]);
	const afterRefund = await service.checkLimits("203.0.113.1", { isAuthenticated: false });
	assert.equal(afterRefund.allowed, true);
});
