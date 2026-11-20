import assert from "node:assert/strict";
import test from "node:test";
import { fixture } from "../../packages/cli/test/fixture";
import { RateLimitService } from "./rate-limit.js";

test("atomically enforces and refunds anonymous minute quotas", async (t) => {
	const f = await fixture();
	t.after(() => f.close());
	const service = new RateLimitService(f.env.DB);
	const decisions = [];

	for (let index = 0; index < 3; index++) {
		decisions.push(await service.checkLimits("203.0.113.1", { isAuthenticated: false }));
	}

	assert.ok(decisions.every((decision) => decision.allowed));
	const limited = await service.checkLimits("203.0.113.1", { isAuthenticated: false });
	assert.equal(limited.allowed, false);
	assert.equal(limited.limitType, "minute");

	await service.refund(decisions[0]);
	await service.refund(decisions[0]);
	assert.equal(
		(await service.getStatus("203.0.113.1", { isAuthenticated: false })).minuteRemaining,
		1,
	);
	const afterRefund = await service.checkLimits("203.0.113.1", { isAuthenticated: false });
	assert.equal(afterRefund.allowed, true);
});

test("a lost commit acknowledgement refunds both counts exactly once", async (t) => {
	const f = await fixture();
	t.after(() => f.close());
	const batch = f.env.DB.batch.bind(f.env.DB);
	t.mock.method(f.env.DB, "batch", async (stmts: D1PreparedStatement[]) => {
		await batch(stmts);
		throw Error("lost acknowledgement");
	});
	const service = new RateLimitService(f.env.DB);
	await assert.rejects(
		service.checkLimits("203.0.113.1", { isAuthenticated: false }),
		/lost acknowledgement/,
	);
	assert.equal(f.sql.prepare("SELECT sum(count) AS n FROM usage_counters").get()?.n, 0);
});

test("failure to write the minute counter leaves the weekly counter unchanged", async (t) => {
	const f = await fixture();
	t.after(() => f.close());
	f.sql.exec(
		"CREATE TRIGGER reject_minute BEFORE INSERT ON usage_counters WHEN NEW.period='minute' BEGIN SELECT RAISE(ABORT,'fixture minute counter failure'); END",
	);
	const service = new RateLimitService(f.env.DB);
	await assert.rejects(
		service.checkLimits("203.0.113.12", { isAuthenticated: false }),
		/fixture minute/,
	);
	assert.equal(f.sql.prepare("SELECT count(*) n FROM usage_counters").get()?.n, 0);
});
