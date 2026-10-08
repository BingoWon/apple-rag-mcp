import assert from "node:assert/strict";
import test from "node:test";
import { createModelAlertReporter } from "../mcp-utils/model-alerts.js";
import { sendTelegram } from "./telegram.js";
import type { Env } from "./types.js";

test("model alerts register background work, redact credentials, and coalesce repeats", async (t) => {
	const pending: Promise<unknown>[] = [];
	const messages: string[] = [];
	t.mock.method(globalThis, "fetch", async (_url, init) => {
		messages.push(JSON.parse(String(init?.body)).text);
		return Response.json({ ok: true });
	});
	const report = createModelAlertReporter(
		{
			TYPESAFE_API_KEY: "jev-secret",
			DEEPINFRA_API_KEY: "deep-secret",
			TELEGRAM_ALERT_BOT_URL: "https://example.invalid/coalesce",
		} as Env,
		{ waitUntil: (promise) => pending.push(promise) },
	);
	report("balance", "failed jev-secret deep-secret");
	report("balance", "failed jev-secret deep-secret");
	await Promise.all(pending);
	assert.equal(messages.length, 1);
	assert.equal(pending.length, 1);
	assert.ok(!messages[0].includes("jev-secret"));
	assert.ok(!messages[0].includes("deep-secret"));
	assert.match(messages[0], /\[REDACTED\]/);
});

test("a changed failure is not suppressed by another provider's cooldown", async (t) => {
	let calls = 0;
	const pending: Promise<unknown>[] = [];
	t.mock.method(globalThis, "fetch", async () => {
		calls++;
		return Response.json({ ok: true });
	});
	const report = createModelAlertReporter(
		{
			TELEGRAM_ALERT_BOT_URL: "https://example.invalid/different",
			DEEPINFRA_API_KEY: "key",
		} as Env,
		{ waitUntil: (promise) => pending.push(promise) },
	);
	report("jev402", "Jev credits exhausted; backup recovered");
	report("jev402-qwen403", "Both providers failed");
	await Promise.all(pending);
	assert.equal(calls, 2);
});

test("failed Telegram delivery does not permanently suppress the next alert", async (t) => {
	let delivered = false;
	let calls = 0;
	const pending: Promise<unknown>[] = [];
	t.mock.method(globalThis, "fetch", async () => {
		calls++;
		return Response.json({ ok: delivered }, { status: delivered ? 200 : 403 });
	});
	const report = createModelAlertReporter(
		{
			TELEGRAM_ALERT_BOT_URL: "https://example.invalid/retry-later",
			DEEPINFRA_API_KEY: "key",
		} as Env,
		{ waitUntil: (promise) => pending.push(promise) },
	);
	report("error", "Failed");
	await Promise.all(pending);
	delivered = true;
	report("error", "Failed");
	await Promise.all(pending);
	assert.equal(calls, 2);
});

test("Telegram temporary failures get one bounded retry", async (t) => {
	let calls = 0;
	t.mock.method(globalThis, "fetch", async () => {
		calls++;
		return calls === 1
			? Response.json({ ok: false }, { status: 503, headers: { "retry-after": "0" } })
			: Response.json({ ok: true });
	});
	assert.equal(await sendTelegram("https://example.invalid/transient", "message"), true);
	assert.equal(calls, 2);
});

test("Telegram long rate-limit delays are not retried early", async (t) => {
	let calls = 0;
	t.mock.method(globalThis, "fetch", async () => {
		calls++;
		return Response.json({ ok: false, parameters: { retry_after: 30 } }, { status: 429 });
	});
	assert.equal(await sendTelegram("https://example.invalid/limited", "message"), false);
	assert.equal(calls, 1);
});

test("Telegram body rejection and a missing URL are not reported as delivery", async (t) => {
	t.mock.method(globalThis, "fetch", async () =>
		Response.json({ ok: false, description: "rejected" }),
	);
	assert.equal(await sendTelegram("https://example.invalid/rejected", "message"), false);
	assert.equal(await sendTelegram(undefined, "message"), false);
});
