import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import {
	CLI_CLIENT_ID,
	CLI_RESOURCE,
	CLI_SCOPE,
	cliCredentialsSchema,
} from "../../../shared/contracts.js";
import { challenge, loopbackRedirect, OAuthError } from "../../../worker/cli/authorization.js";
import { fixture, TOKEN } from "./fixture.js";

async function setup(t: test.TestContext) {
	const f = await fixture();
	t.after(() => f.close());
	return f;
}
async function grant(f: Awaited<ReturnType<typeof fixture>>) {
	const verifier = randomBytes(32).toString("base64url");
	const input = {
		client_id: CLI_CLIENT_ID,
		response_type: "code",
		code_challenge_method: "S256",
		code_challenge: await challenge(verifier),
		redirect_uri: "http://127.0.0.1:12345/callback",
		state: randomBytes(32).toString("base64url"),
		scope: CLI_SCOPE,
		resource: f.endpoint + CLI_RESOURCE,
	};
	const result = await f.authorization.start(input, "code");
	const request = new URL(result.authorization_url!).searchParams.get("request")!;
	const approved = await f.authorization.decide("reader", true, request);
	const callback = new URL(approved.redirect_uri!);
	assert.equal(callback.searchParams.get("state"), input.state);
	assert.equal(callback.searchParams.get("iss"), f.endpoint);
	return {
		request,
		input: {
			client_id: CLI_CLIENT_ID,
			grant_type: "authorization_code",
			code: callback.searchParams.get("code")!,
			code_verifier: verifier,
			redirect_uri: input.redirect_uri,
		},
	};
}
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

test("PKCE code binds client, resource, redirect and one-time exchange; refresh rotates and replay revokes family", async (t) => {
	const f = await setup(t);
	const g = await grant(f);
	for (const extra of [
		{ code_verifier: "x".repeat(43) },
		{ redirect_uri: "http://127.0.0.1:54321/callback" },
		{ client_id: "other" },
		{ resource: "https://other.test/api" },
	])
		await assert.rejects(f.authorization.exchange({ ...g.input, ...extra }), OAuthError);
	const credentials = cliCredentialsSchema.parse(await f.authorization.exchange(g.input));
	assert.equal(credentials.expires_in, 900);
	await assert.rejects(f.authorization.exchange(g.input), OAuthError);
	const request = (token: string) => new Request(f.endpoint, { headers: bearer(token) });
	assert.equal(
		(await f.authorization.authenticate(request(credentials.access_token))).authMethod,
		"oauth",
	);
	const rotated = await f.authorization.exchange({
		client_id: CLI_CLIENT_ID,
		grant_type: "refresh_token",
		refresh_token: credentials.refresh_token,
	});
	assert.notEqual(rotated.refresh_token, credentials.refresh_token);
	await assert.rejects(
		f.authorization.exchange({
			client_id: CLI_CLIENT_ID,
			grant_type: "refresh_token",
			refresh_token: credentials.refresh_token,
		}),
		OAuthError,
	);
	await assert.rejects(f.authorization.authenticate(request(rotated.access_token)), OAuthError);
	assert.equal(f.sql.prepare("SELECT count(*) AS n FROM mcp_tokens").get()?.n, 2);
});

test("credentials cannot cross CLI, MCP and website APIs, even when JWT prefixes are removed", async (t) => {
	const f = await setup(t);
	const g = await grant(f);
	const pair = await f.authorization.exchange(g.input);
	for (const token of [TOKEN, f.webToken, pair.refresh_token!, pair.access_token.slice(9)]) {
		const r = await fetch(`${f.endpoint + CLI_RESOURCE}/account`, { headers: bearer(token) });
		assert.equal(r.status, 401);
	}
	for (const token of [
		f.cliKey,
		pair.access_token,
		pair.access_token.slice(9),
		pair.refresh_token!,
	]) {
		assert.equal(
			(await fetch(`${f.endpoint}/api/cli/sessions`, { headers: bearer(token) })).status,
			401,
		);
		assert.equal((await fetch(`${f.endpoint}/account`, { headers: bearer(token) })).status, 401);
	}
	assert.equal(
		(await fetch(`${f.endpoint}/api/cli/sessions`, { headers: bearer(f.webToken) })).status,
		200,
	);
	assert.equal(
		(await fetch(`${f.endpoint + CLI_RESOURCE}/account`, { headers: bearer(f.cliKey) })).status,
		200,
	);
	const id = f.sql.prepare("SELECT id FROM cli_sessions WHERE kind='api_key'").get()!.id as string;
	await f.authorization.revokeSession(id, "other-user");
	assert.equal(
		(await fetch(`${f.endpoint + CLI_RESOURCE}/account`, { headers: bearer(f.cliKey) })).status,
		200,
	);
	await f.authorization.revokeSession(id, "reader");
	assert.equal(
		(await fetch(`${f.endpoint + CLI_RESOURCE}/account`, { headers: bearer(f.cliKey) })).status,
		401,
	);
});

test("device polling, denial, expiry, request validation, atomic session bounds and rate limits", async (t) => {
	const f = await setup(t);
	for (const uri of [
		"https://127.0.0.1:4/callback",
		"http://localhost:4/callback",
		"http://127.0.0.1/callback",
		"http://127.0.0.1:4/other",
		"http://user@127.0.0.1:4/callback",
		"http://127.0.0.1:4/callback?x=1",
	]) {
		assert.throws(() => loopbackRedirect(uri), OAuthError);
	}
	for (const input of [
		{ client_id: "other" },
		{ client_id: CLI_CLIENT_ID, scope: "admin" },
		{ client_id: CLI_CLIENT_ID, resource: "https://other.test" },
	])
		await assert.rejects(f.authorization.start(input, "device"), OAuthError);
	const d = await f.authorization.start({ client_id: CLI_CLIENT_ID }, "device");
	const poll = {
		client_id: CLI_CLIENT_ID,
		grant_type: "urn:ietf:params:oauth:grant-type:device_code",
		device_code: d.device_code,
	};
	await assert.rejects(
		f.authorization.exchange(poll),
		(e: unknown) => e instanceof OAuthError && e.error === "authorization_pending",
	);
	await assert.rejects(
		f.authorization.exchange(poll),
		(e: unknown) => e instanceof OAuthError && e.error === "slow_down",
	);
	await f.authorization.decide("reader", false, undefined, d.user_code!);
	f.sql.exec("UPDATE cli_authorizations SET next_poll_at=0");
	await assert.rejects(
		f.authorization.exchange(poll),
		(e: unknown) => e instanceof OAuthError && e.error === "access_denied",
	);
	f.sql.exec("UPDATE cli_authorizations SET expires_at=0");
	await assert.rejects(f.authorization.exchange(poll), OAuthError);
	const g = await grant(f);
	for (let i = 1; i < 20; i++) await f.authorization.createKey("reader", `key ${i}`, 7);
	await assert.rejects(f.authorization.createKey("reader", "overflow", 7), OAuthError);
	await assert.rejects(f.authorization.exchange(g.input), OAuthError);
	assert.equal((await f.authorization.list("reader")).length, 20);
	const id = f.sql.prepare("SELECT id FROM cli_sessions LIMIT 1").get()!.id as string;
	await f.authorization.revokeSession(id, "reader");
	await f.authorization.exchange(g.input);
	assert.equal((await f.authorization.list("reader")).length, 20);
	await f.authorization.rateLimit("fixture", "test", 1);
	await assert.rejects(f.authorization.rateLimit("fixture", "test", 1), OAuthError);
});

test("server assigns CLI log channel and credential IDs, rejects raw MCP credentials without IP fallback", async (t) => {
	const f = await setup(t);
	f.sql.exec(
		"INSERT INTO user_authorized_ips(user_id,ip_address,name) VALUES('reader','203.0.113.1','fixture')",
	);
	for (const [token, status] of [
		[f.cliKey, 200],
		[TOKEN, 401],
	] as const) {
		const r = await fetch(`${f.endpoint + CLI_RESOURCE}/search`, {
			method: "POST",
			headers: {
				...bearer(token),
				"Content-Type": "application/json",
				"X-Channel": "mcp",
				"User-Agent": "fake-mcp/1.0",
			},
			body: JSON.stringify({ query: "SwiftUI" }),
		});
		assert.equal(r.status, status);
		const result = await r.json();
		assert.equal(r.headers.get("X-Request-ID"), result.request_id);
	}
	await f.flush();
	const rows = f.sql.prepare("SELECT * FROM search_logs ORDER BY rowid").all();
	assert.equal(rows.length, 2);
	assert(rows.every((r) => r.channel === "cli"));
	assert(rows[0].credential_id);
	assert.equal(rows[0].auth_method, "api_key");
	assert.equal(rows[1].credential_id, null);
	assert(!JSON.stringify(rows).includes(TOKEN));
	assert(!JSON.stringify(rows).includes(f.cliKey));
	assert.equal(f.retrieved, 1);
});

test("website management errors keep their HTTP status and expired devices cannot authorize", async (t) => {
	const f = await setup(t);
	const r = await fetch(`${f.endpoint}/api/cli/sessions`, {
		method: "POST",
		headers: { ...bearer(f.webToken), "Content-Type": "application/json" },
		body: JSON.stringify({ name: "Invalid", days: 0 }),
	});
	assert.equal(r.status, 400);
	const g = await grant(f);
	const pair = await f.authorization.exchange(g.input);
	f.sql.exec("UPDATE cli_sessions SET expires_at=0 WHERE kind='device'");
	await assert.rejects(
		f.authorization.authenticate(new Request(f.endpoint, { headers: bearer(pair.access_token) })),
		OAuthError,
	);
	await assert.rejects(
		f.authorization.exchange({
			client_id: CLI_CLIENT_ID,
			grant_type: "refresh_token",
			refresh_token: pair.refresh_token,
		}),
		OAuthError,
	);
});

test("user history preserves channel, excludes secrets and includes 4xx errors with valid combined SQL", async (t) => {
	const f = await setup(t);
	f.sql.exec(
		"INSERT INTO search_logs(user_id,requested_query,actual_query,status_code,channel,credential_id) VALUES('reader','Swift','Swift',200,'cli','cli-id'),('reader','limited','limited',429,'mcp','mcp-id'); INSERT INTO fetch_logs(user_id,requested_url,status_code,channel) VALUES('reader','https://example.com/a%_b',404,'cli'),('someone-else','private',200,'cli')",
	);
	for (const kind of ["all", "search", "fetch"]) {
		const r = await fetch(`${f.endpoint}/api/usage-logs/history?log_type=${kind}`, {
			headers: bearer(f.webToken),
		});
		assert.equal(r.status, 200);
		const { data } = await r.json();
		assert.equal(data.items.length, kind === "all" ? 3 : kind === "search" ? 2 : 1);
		assert(data.items.every((r: Record<string, unknown>) => r.channel && !("mcp_token" in r)));
	}
	const errors = await (
		await fetch(`${f.endpoint}/api/usage-logs/history?status=error`, {
			headers: bearer(f.webToken),
		})
	).json();
	assert.equal(errors.data.pagination.total, 2);
	const literal = await (
		await fetch(`${f.endpoint}/api/usage-logs/history?search=%25_`, { headers: bearer(f.webToken) })
	).json();
	assert.equal(literal.data.pagination.total, 1);
});
