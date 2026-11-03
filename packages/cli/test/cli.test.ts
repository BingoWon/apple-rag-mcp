import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { AppleRagClient } from "../src/client.js";
import { VERSION } from "../src/version.js";
import { fixture, SECOND_TOKEN, TOKEN } from "./fixture.js";

async function setup(t: test.TestContext) {
	const server = await fixture();
	const directory = await mkdtemp(join(tmpdir(), "apple-rag-cli-"));
	t.after(async () => {
		await server.close();
		await rm(directory, { recursive: true, force: true });
	});
	const env = { ...process.env, APPLE_RAG_URL: server.endpoint, APPLE_RAG_CONFIG_DIR: directory };
	delete env.APPLE_RAG_TOKEN;
	const command = (args: string[], overrides: NodeJS.ProcessEnv = {}, input?: string) => {
		const child = spawn(
			process.execPath,
			["--import", "tsx", fileURLToPath(new URL("../src/cli.ts", import.meta.url)), ...args],
			{ env: { ...env, ...overrides }, stdio: ["pipe", "pipe", "pipe"] },
		);
		let stdout = "",
			stderr = "";
		child.stdout.on("data", (chunk) => {
			stdout += chunk;
		});
		child.stderr.on("data", (chunk) => {
			stderr += chunk;
		});
		child.stdin.end(input);
		const done = new Promise<{ code: number | null; stdout: string; stderr: string }>(
			(resolve, reject) => {
				child.once("error", reject);
				child.once("close", (code) => resolve({ code, stdout, stderr }));
			},
		);
		return { child, done };
	};
	const run = (args: string[], overrides?: NodeJS.ProcessEnv, input?: string) =>
		command(args, overrides, input).done;
	return { server, directory, run, command };
}

test("login verifies before saving; status tracks upgrade/expiry/cancellation without consuming quota", async (t) => {
	const { run, server, directory } = await setup(t);
	const anonymous = await run(["auth", "status", "--json"]);
	assert.equal(JSON.parse(anonymous.stdout).plan, "anonymous");
	const login = await run(["auth", "login", "--token-stdin"], {}, `${TOKEN}\n`);
	assert.equal(login.code, 0, login.stderr);
	assert.match(login.stderr, /Free/);
	assert(!login.stdout.includes(TOKEN) && !login.stderr.includes(TOKEN));
	if (process.platform !== "win32")
		assert.equal((await stat(join(directory, "credentials.json"))).mode & 0o777, 0o600);
	const status = async () => {
		const response = await run(["auth", "status", "--json"]);
		assert.equal(response.code, 0, response.stderr);
		return JSON.parse(response.stdout);
	};
	assert.equal((await status()).plan, "hobby");
	server.sql.exec(
		"INSERT INTO user_subscriptions(user_id,plan_type,status) VALUES('reader','pro','active')",
	);
	assert.equal((await status()).quota.week.limit, 50000);
	server.sql.exec("UPDATE user_subscriptions SET status='canceled'");
	assert.equal((await status()).plan, "hobby");
	server.sql.exec(
		"UPDATE user_subscriptions SET status='active', payment_type='one_time', current_period_end='2000-01-01T00:00:00Z'",
	);
	assert.equal((await status()).plan, "hobby");
	server.sql.exec("UPDATE user_subscriptions SET current_period_end='2999-01-01T00:00:00Z'");
	assert.equal((await status()).plan, "pro");
	assert.equal(server.sql.prepare("SELECT COUNT(*) AS n FROM usage_counters").get()?.n, 0);
	assert.equal(server.retrieved, 0);
	const previous = await readFile(join(directory, "credentials.json"), "utf8");
	const bad = await run(["auth", "login", "--token-stdin"], {}, `at_${"f".repeat(32)}\n`);
	assert.equal(bad.code, 3, bad.stderr);
	assert.equal(await readFile(join(directory, "credentials.json"), "utf8"), previous);
	assert.equal((await run(["auth", "logout"])).code, 0);
	assert.equal((await status()).plan, "anonymous");
});

test("CLI and native MCP requests share account quotas across tokens; 429 is an error even with HTTP 200", async (t) => {
	const { run, server } = await setup(t);
	const env = { APPLE_RAG_TOKEN: TOKEN };
	const first = await run(["search", "SwiftUI", "--json"], env);
	assert.equal(first.code, 0, first.stderr);
	const data = JSON.parse(first.stdout);
	assert.equal(data.results[0].complete, false);
	assert.equal(data.account.plan, "hobby");
	assert.equal(data.account.quota.week.remaining, 49);
	// Another MCP client/token consumes the same user identifier.
	const response = await new AppleRagClient(
		server.endpoint,
		SECOND_TOKEN,
		AbortSignal.timeout(10000),
	).call("search", { query: "SwiftUI", result_count: 1 });
	assert(response.ok);
	assert.equal(response.account.quota.week.remaining, 48);
	const second = await run(["fetch", "https://example.com/old", "--json"], {
		APPLE_RAG_TOKEN: SECOND_TOKEN,
	});
	assert.equal(second.code, 0, second.stderr);
	const page = JSON.parse(second.stdout);
	assert.equal(page.account.quota.week.remaining, 47);
	assert.equal(page.source, "third_party");
	assert.equal(page.provider, "firecrawl");
	assert.equal(page.cache_hit, true);
	assert.equal(page.url, "https://example.com/final");
	await run(["search", "SwiftUI"], env);
	await run(["search", "SwiftUI"], env);
	const limited = await run(["search", "SwiftUI", "--json"], env);
	assert.equal(limited.code, 4, limited.stderr);
	assert.equal(JSON.parse(limited.stdout).error.code, "RATE_LIMIT_EXCEEDED");
	assert.match(limited.stderr, /Upgrade to Pro/);
	assert.equal(server.retrieved, 5);
});

test("invalid or revoked explicit tokens never fall back to saved/IP credentials and never leak", async (t) => {
	const { run, server } = await setup(t);
	await run(["auth", "login", "--token-stdin"], {}, TOKEN);
	server.sql.exec(
		"INSERT INTO user_authorized_ips(user_id,ip_address,name) VALUES('reader','203.0.113.1','fixture')",
	);
	for (const token of ["", "bad-secret", `at_${"a".repeat(32)}`]) {
		const result = await run(["search", "SwiftUI", "--json"], { APPLE_RAG_TOKEN: token });
		assert.equal(result.code, 3, result.stderr);
		assert.equal(JSON.parse(result.stdout).error.code, "INVALID_TOKEN");
		if (token) assert(!result.stdout.includes(token) && !result.stderr.includes(token));
	}
	server.sql.prepare("DELETE FROM mcp_tokens WHERE mcp_token=?").run(TOKEN);
	assert.equal((await run(["auth", "status", "--json"])).code, 3);
	assert.equal(server.retrieved, 0);
	await run(["auth", "logout"]);
	const ip = JSON.parse((await run(["auth", "status", "--json"])).stdout);
	assert.equal(ip.auth_method, "ip");
	assert.equal(ip.plan, "hobby");
});

test("empty search, 404, failures/refunds, no-clobber output and invalid arguments have distinct results", async (t) => {
	const { run, directory, server } = await setup(t);
	server.sql.exec(
		"INSERT INTO user_subscriptions(user_id,plan_type,status) VALUES('reader','pro','active')",
	);
	const env = { APPLE_RAG_TOKEN: TOKEN };
	const empty = await run(["search", "empty", "--json"], env);
	assert.equal(empty.code, 0, empty.stderr);
	assert.equal(JSON.parse(empty.stdout).outcome, "no_content");
	const missing = await run(["fetch", "https://example.com/missing", "--json"], env);
	assert.equal(missing.code, 5, missing.stderr);
	assert.equal(JSON.parse(missing.stdout).error.code, "PAGE_NOT_FOUND");
	const failed = await run(["search", "fail", "--json"], env);
	assert.equal(failed.code, 1);
	assert.equal(JSON.parse(failed.stdout).error.code, "SEARCH_FAILED");
	const status = JSON.parse((await run(["auth", "status", "--json"], env)).stdout);
	assert.equal(status.quota.week.remaining, 49999);
	const path = join(directory, "page.md");
	const saved = await run(["fetch", "https://example.com", "--output", path], env);
	assert.equal(saved.code, 0, saved.stderr);
	assert.equal(saved.stdout, "");
	assert.match(await readFile(path, "utf8"), /Third-party website/);
	const before = await readFile(path, "utf8");
	const beforeExisting = server.retrieved;
	assert.equal((await run(["fetch", "https://example.com", "--output", path], env)).code, 1);
	assert.equal(await readFile(path, "utf8"), before);
	assert.equal(server.retrieved, beforeExisting, "Existing output must fail before spending quota");
	const count = server.retrieved;
	for (const args of [
		["search", "x", "--limit", "0"],
		["search", " "],
		["search", "x", "--unknown"],
		["fetch", "x".repeat(2049)],
		["doctor", "--output", path],
		["auth", "login", "--json"],
	])
		assert.equal((await run(args, env)).code, 2);
	assert.equal(server.retrieved, count);
});

test("doctor is quota-free, credential binding prevents cross-endpoint forwarding, permissions fail closed", async (t) => {
	const { run, directory, server } = await setup(t);
	assert.equal((await run(["--help"])).code, 0);
	assert.equal((await run(["--version"])).stdout.trim(), VERSION);
	await run(["auth", "login", "--token-stdin"], {}, TOKEN);
	const diagnosis = await run(["doctor", "--json"]);
	assert.equal(diagnosis.code, 0, diagnosis.stderr);
	assert.equal(JSON.parse(diagnosis.stdout).retrieval_tested, false);
	assert.equal(server.sql.prepare("SELECT COUNT(*) AS n FROM usage_counters").get()?.n, 0);
	const credentials = join(directory, "credentials.json");
	await writeFile(
		credentials,
		JSON.stringify({ endpoint: "https://other.example", token: TOKEN }),
		{ mode: 0o600 },
	);
	server.requests.length = 0;
	assert.equal(JSON.parse((await run(["auth", "status", "--json"])).stdout).plan, "anonymous");
	assert(server.requests.every((request) => !request.authorization));
	if (process.platform !== "win32") {
		await chmod(credentials, 0o644);
		assert.equal((await run(["auth", "status", "--json"])).code, 1);
	}
	assert.equal(
		(await run(["auth", "status", "--json"], { APPLE_RAG_URL: "http://remote.example" })).code,
		2,
	);
});

test("SIGINT cancels a running SDK tool call and refunds its reservation", {
	skip: process.platform === "win32",
}, async (t) => {
	const { command, server } = await setup(t);
	const { child, done } = command(["search", "slow", "--json"], { APPLE_RAG_TOKEN: TOKEN });
	const deadline = Date.now() + 10000;
	while (!server.retrieved && Date.now() < deadline)
		await new Promise((resolve) => setTimeout(resolve, 20));
	assert.equal(server.retrieved, 1);
	child.kill("SIGINT");
	const result = await done;
	assert.equal(result.code, 130, result.stderr);
	assert.equal(JSON.parse(result.stdout).error.code, "CANCELLED");
	const until = Date.now() + 3000;
	while (!server.cancelObserved && Date.now() < until)
		await new Promise((resolve) => setTimeout(resolve, 20));
	assert.equal(server.cancelObserved, true);
	await new Promise((resolve) => setTimeout(resolve, 30));
	assert.equal(
		server.sql.prepare("SELECT SUM(count) AS n FROM usage_counters WHERE identifier='reader'").get()
			?.n,
		0,
	);
});

test("keyboard Ctrl+C in the real login terminal cancels without a network-error message", {
	skip: process.platform === "win32",
}, () => {
	const env = { ...process.env };
	delete env.APPLE_RAG_TOKEN;
	const result = spawnSync(
		"python3",
		[
			fileURLToPath(new URL("./login-pty.py", import.meta.url)),
			process.execPath,
			"--import",
			"tsx",
			fileURLToPath(new URL("../src/cli.ts", import.meta.url)),
			"auth",
			"login",
		],
		{ env, encoding: "utf8", timeout: 15000 },
	);
	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stdout, /Keyboard cancellation passed/);
});
