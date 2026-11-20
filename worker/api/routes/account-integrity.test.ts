import assert from "node:assert/strict";
import test from "node:test";
import { fixture } from "../../../packages/cli/test/fixture";
import { extractUserFromJWTToken } from "../../../src/utils/mcpTokenUtils";
import { IPAuthenticationService } from "../../services/ip-authentication";
import { authRoutes as auth } from "./auth";
import contact from "./contact-messages";
import tokens from "./mcp-tokens";
import { oauthRoutes } from "./oauth";

test("a Unicode OAuth profile exchanges once and logout or a password change revokes the session", async (t) => {
	const f = await fixture();
	t.after(() => f.close());
	const init = await oauthRoutes.request(
		"/google",
		{ method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
		f.env,
	);
	assert.equal(init.status, 200);
	const state = new URL((await init.json()).data.auth_url).searchParams.get("state");
	const cookie = init.headers.get("set-cookie")!.split(";")[0];
	t.mock.method(globalThis, "fetch", async (input: string | Request | URL) =>
		String(input).endsWith("/token")
			? Response.json({ access_token: "mock" })
			: Response.json({
					id: "fixture-google",
					email: "zh@example.test",
					name: "林 🦊",
					picture: "https://example.test/image",
					verified_email: true,
				}),
	);
	const bad = await oauthRoutes.request(
		"/google/callback?code=local&state=incorrect",
		{ headers: { cookie } },
		f.env,
	);
	assert.match(bad.headers.get("location")!, /error=/);
	const second = await oauthRoutes.request(
		"/google",
		{ method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
		f.env,
	);
	const secondState = new URL((await second.json()).data.auth_url).searchParams.get("state");
	const secondCookie = second.headers.get("set-cookie")!.split(";")[0];
	assert.notEqual(cookie.split("=")[0], secondCookie.split("=")[0]);
	f.sql.exec(
		"CREATE TRIGGER reject_oauth_session BEFORE INSERT ON web_sessions BEGIN SELECT RAISE(ABORT,'fixture write failure'); END",
	);
	const failed = await oauthRoutes.request(
		"/google/callback?code=local&state=" + secondState,
		{ headers: { cookie: secondCookie } },
		f.env,
	);
	assert.equal(failed.headers.get("location"), "/login?error=oauth_failed");
	assert.equal(
		f.sql.prepare("SELECT count(*) n FROM users WHERE email='zh@example.test'").get()?.n,
		0,
	);
	f.sql.exec("DROP TRIGGER reject_oauth_session");
	const callback = await oauthRoutes.request(
		"/google/callback?code=local&state=" + state,
		{ headers: { cookie } },
		f.env,
	);
	assert.equal(new URL(callback.headers.get("location")!).searchParams.get("login"), state);
	const replay = await oauthRoutes.request(
		"/google/callback?code=local&state=" + state,
		{ headers: { cookie } },
		f.env,
	);
	assert.match(replay.headers.get("location")!, /error=/);
	const handoff = callback.headers
		.getSetCookie()
		.find((value) => value.startsWith(`oauth_handoff_${state}=`))!;
	assert.match(handoff, /HttpOnly/);
	const exchange = () =>
		oauthRoutes.request(
			"/session/exchange",
			{
				method: "POST",
				headers: { cookie: handoff.split(";")[0], "Content-Type": "application/json" },
				body: JSON.stringify({ state }),
			},
			f.env,
		);
	const result = await exchange();
	assert.equal(result.status, 200);
	const token = (await result.json()).data.token;
	assert.equal(extractUserFromJWTToken(token).name, "林 🦊");
	assert.equal((await exchange()).status, 401);
	const headers = { Authorization: "Bearer " + token };
	assert.equal((await tokens.request("/", { headers }, f.env)).status, 200);
	assert.equal((await auth.request("/logout", { method: "POST", headers }, f.env)).status, 200);
	assert.equal((await tokens.request("/", { headers }, f.env)).status, 401);
	f.sql.exec("UPDATE users SET password_hash='new-fixture' WHERE id='reader'");
	assert.equal(
		(await tokens.request("/", { headers: { Authorization: "Bearer " + f.webToken } }, f.env))
			.status,
		401,
	);
});

test("token mutations return the stored record and contact messages use the authenticated owner", async (t) => {
	const f = await fixture();
	t.after(() => f.close());
	const headers = { Authorization: "Bearer " + f.webToken, "Content-Type": "application/json" };
	const updated = await tokens.request(
		"/0",
		{ method: "PUT", headers, body: JSON.stringify({ name: "Build agent" }) },
		f.env,
	);
	assert.equal(updated.status, 200);
	assert.equal((await updated.json()).data.name, "Build agent");
	assert.equal((await tokens.request("/0", { method: "DELETE", headers }, f.env)).status, 200);
	assert.equal((await tokens.request("/0", { method: "DELETE", headers }, f.env)).status, 404);
	for (const loggedIn of [true, false]) {
		const request = await contact.request(
			"/",
			{
				method: "POST",
				headers: loggedIn ? headers : { "Content-Type": "application/json" },
				body: JSON.stringify({ message: "Test", userId: "ignored" }),
			},
			f.env,
		);
		assert.equal(request.status, 201);
		const id = (await request.json()).data.id;
		assert.equal(
			f.sql.prepare("SELECT user_id FROM contact_messages WHERE id=?").get(id)?.user_id,
			loggedIn ? "reader" : null,
		);
	}
});
test("canonical IPv6 grants identity only for a single account", async (t) => {
	const f = await fixture();
	t.after(() => f.close());
	const pending: Promise<unknown>[] = [];
	const ip = new IPAuthenticationService(f.env.DB, { waitUntil: (job) => pending.push(job) });
	f.sql.exec(
		"INSERT INTO user_authorized_ips(user_id,ip_address,name) VALUES('reader','2001:db8::1','Office')",
	);
	assert.equal(
		(await ip.checkIPAuthentication("2001:0DB8:0000:0000:0000:0000:0000:0001"))?.userId,
		"reader",
	);
	f.sql.exec(
		"INSERT INTO users(id,email,name,created_at,updated_at) VALUES('other','other@example.test','Other',datetime('now'),datetime('now')); INSERT INTO user_authorized_ips(user_id,ip_address,name) VALUES('other','2001:db8::1','Office')",
	);
	assert.equal(await ip.checkIPAuthentication("2001:db8::1"), null);
	await Promise.all(pending);
});

test("email registration rolls back with its first session and a retry can sign in", async (t) => {
	const f = await fixture();
	t.after(() => f.close());
	const input = {
		email: "lin@example.test",
		name: "小林 🦊",
		password: "local-only-test",
		terms_accepted: true,
	};
	const post = (path: string, body: unknown) =>
		auth.request(
			path,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			},
			f.env,
		);
	f.sql.exec(
		"CREATE TRIGGER reject_session BEFORE INSERT ON web_sessions BEGIN SELECT RAISE(ABORT,'fixture session failure'); END",
	);
	assert.equal((await post("/register", input)).status, 500);
	assert.equal(f.sql.prepare("SELECT count(*) n FROM users WHERE email=?").get(input.email)?.n, 0);
	f.sql.exec("DROP TRIGGER reject_session");
	assert.equal((await post("/register", input)).status, 201);
	assert.equal((await post("/register", input)).status, 409);
	const login = await post("/login", input);
	assert.equal(login.status, 200);
	assert.equal(extractUserFromJWTToken((await login.json()).data.token).name, input.name);
});
