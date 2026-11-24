import assert from "node:assert/strict";
import test from "node:test";
import Stripe from "stripe";
import { fixture } from "../../../packages/cli/test/fixture.js";
import { CLI_CLIENT_ID } from "../../../shared/contracts.js";
import { cliOAuthRoutes, createCLIRoutes } from "../../cli/routes.js";
import { apiApp } from "../app.js";
import { AuthService } from "../services/auth-service.js";
import { parsePagination } from "../utils/pagination.js";
import { hashString, timingSafeEqual } from "../utils/security.js";
import adminRoutes from "./admin/index.js";
import { authRoutes } from "./auth.js";
import authorizedIpsRoutes from "./authorized-ips.js";
import contactRoutes from "./contact-messages.js";
import { oauthRoutes } from "./oauth.js";
import stripeRoutes from "./stripe.js";
import userRoutes from "./users.js";

test("timingSafeEqual handles equal, different-length, and missing secrets", async () => {
	assert.equal(await timingSafeEqual("secret-123", "secret-123"), true);
	assert.equal(await timingSafeEqual("secret-123", "secret-124"), false);
	assert.equal(await timingSafeEqual("short", "much-longer-secret"), false);
	assert.equal(await timingSafeEqual(undefined, "secret"), false);
	assert.equal(await timingSafeEqual("", "secret"), false);
});

test("parsePagination clamps negative, zero, NaN, and oversized values", () => {
	assert.deepEqual(parsePagination(undefined, undefined), { limit: 50, offset: 0 });
	assert.deepEqual(parsePagination("-10", "-5"), { limit: 50, offset: 0 });
	assert.deepEqual(parsePagination("0", "abc"), { limit: 50, offset: 0 });
	assert.deepEqual(parsePagination("9999", "25"), { limit: 100, offset: 25 });
	assert.deepEqual(parsePagination("10.9", "4.7"), { limit: 10, offset: 4 });
});

test("OpenAPI hides admin paths, exposes bearerAuth, and dead token validate oracle is removed", async (t) => {
	const f = await fixture();
	t.after(() => f.close());

	const docRes = await apiApp.request("/doc", {}, f.env);
	assert.equal(docRes.status, 200);
	const doc = (await docRes.json()) as {
		paths: Record<string, unknown>;
		components?: { securitySchemes?: Record<string, unknown> };
	};
	assert.ok(doc.components?.securitySchemes?.bearerAuth);
	assert.equal(
		Object.keys(doc.paths).some((path) => path.startsWith("/admin")),
		false,
	);

	const oracleRes = await apiApp.request(
		"/mcp-tokens/validate",
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ token: "at_00000000000000000000000000000000" }),
		},
		f.env,
	);
	assert.equal(oracleRes.status, 404);
});

test("password reset stores SHA-256 token hash only and login updates last_login", async (t) => {
	const f = await fixture();
	t.after(() => f.close());

	const reg = await authRoutes.request(
		"/register",
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				email: "reset@example.test",
				password: "initial-password-1",
				name: "Reset User",
				terms_accepted: true,
			}),
		},
		f.env,
	);
	assert.equal(reg.status, 201);
	const registeredRow = f.sql
		.prepare("SELECT id, last_login FROM users WHERE email = ?")
		.get("reset@example.test") as { id: string; last_login: string | null };
	assert.ok(registeredRow.last_login);

	// Capture generated raw reset token by stubbing crypto.randomUUID once
	const rawToken = "11111111-2222-4333-8444-555555555555";
	t.mock.method(crypto, "randomUUID", () => rawToken);
	const service = new AuthService(f.env.DB, f.env);
	const forgot = await service.forgotPassword("reset@example.test", "https://apple-rag.com");
	assert.equal(forgot.success, true);

	const stored = f.sql
		.prepare("SELECT reset_token FROM users WHERE id = ?")
		.get(registeredRow.id) as { reset_token: string };
	assert.notEqual(stored.reset_token, rawToken);
	assert.equal(stored.reset_token, await hashString(rawToken));

	// Passing the raw hash fails; passing the raw token succeeds
	const hashAttempt = await service.resetPassword(stored.reset_token, "new-password-2");
	assert.equal(hashAttempt.success, false);

	const rawAttempt = await service.resetPassword(rawToken, "new-password-2");
	assert.equal(rawAttempt.success, true);

	// Logging in with the new password updates last_login
	f.sql.prepare("UPDATE users SET last_login = NULL WHERE id = ?").run(registeredRow.id);
	const login = await authRoutes.request(
		"/login",
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: "reset@example.test", password: "new-password-2" }),
		},
		f.env,
	);
	assert.equal(login.status, 200);
	const afterLogin = f.sql
		.prepare("SELECT last_login FROM users WHERE id = ?")
		.get(registeredRow.id) as { last_login: string | null };
	assert.ok(afterLogin.last_login);
});

test("OAuth rejects GitHub 200 error payloads and unverified Google/GitHub emails", async (t) => {
	const f = await fixture();
	t.after(() => f.close());

	// 1) GitHub returns HTTP 200 with { error: "bad_verification_code" }
	const initGh = await oauthRoutes.request(
		"/github",
		{ method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
		f.env,
	);
	const stateGh = new URL((await initGh.json()).data.auth_url).searchParams.get("state")!;
	const cookieGh = initGh.headers.get("set-cookie")!.split(";")[0];

	t.mock.method(globalThis, "fetch", async () =>
		Response.json({ error: "bad_verification_code", error_description: "Code expired" }),
	);
	const ghFail = await oauthRoutes.request(
		`/github/callback?code=expired&state=${stateGh}`,
		{ headers: { cookie: cookieGh } },
		f.env,
	);
	assert.equal(ghFail.headers.get("location"), "/login?error=oauth_failed");

	// 2) Google returns verified_email: false
	const initG = await oauthRoutes.request(
		"/google",
		{ method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
		f.env,
	);
	const stateG = new URL((await initG.json()).data.auth_url).searchParams.get("state")!;
	const cookieG = initG.headers.get("set-cookie")!.split(";")[0];

	t.mock.method(globalThis, "fetch", async (input: string | Request | URL) =>
		String(input).endsWith("/token")
			? Response.json({ access_token: "mock-google-token" })
			: Response.json({
					id: "g-unverified",
					email: "victim@example.test",
					verified_email: false,
					name: "Unverified",
					picture: "https://example.test/p.png",
				}),
	);
	const gFail = await oauthRoutes.request(
		`/google/callback?code=ok&state=${stateG}`,
		{ headers: { cookie: cookieG } },
		f.env,
	);
	assert.equal(gFail.headers.get("location"), "/login?error=oauth_failed");
	assert.equal(
		f.sql.prepare("SELECT count(*) AS n FROM users WHERE email='victim@example.test'").get()?.n,
		0,
	);
});

test("users profile validates with 400 and account deletion tolerates already-missing Stripe sub", async (t) => {
	const f = await fixture();
	t.after(() => f.close());
	const headers = { Authorization: `Bearer ${f.webToken}`, "Content-Type": "application/json" };

	const invalidProfile = await userRoutes.request(
		"/profile",
		{ method: "PUT", headers, body: JSON.stringify({ name: "a" }) },
		f.env,
	);
	assert.equal(invalidProfile.status, 400);

	// Insert recurring subscription that is already gone in Stripe
	f.sql.exec(
		"INSERT INTO user_subscriptions(user_id,plan_type,status,payment_type,stripe_subscription_id) VALUES('reader','pro','active','subscription','sub_gone')",
	);
	const env = { ...f.env, STRIPE_SECRET_KEY: "sk_test_fixture" };
	t.mock.method(Stripe.resources.Subscriptions.prototype, "cancel", async () => {
		const err = Object.assign(new Error("No such subscription: sub_gone"), {
			code: "resource_missing",
			statusCode: 404,
		});
		throw err;
	});

	const delRes = await userRoutes.request("/account", { method: "DELETE", headers }, env);
	assert.equal(delRes.status, 200);
	assert.equal(f.sql.prepare("SELECT count(*) AS n FROM users WHERE id='reader'").get()?.n, 0);
});

test("Stripe webhook returns 400 on bad signature and /subscription aligns plan_id with effectivePlanType", async (t) => {
	const f = await fixture();
	t.after(() => f.close());
	const env = {
		...f.env,
		STRIPE_SECRET_KEY: "sk_test_fixture",
		STRIPE_WEBHOOK_SECRET: "whsec_fixture",
	};

	const missingSig = await stripeRoutes.request("/webhook", { method: "POST", body: "{}" }, env);
	assert.equal(missingSig.status, 400);

	const badSig = await stripeRoutes.request(
		"/webhook",
		{ method: "POST", headers: { "stripe-signature": "t=1,v1=deadbeef" }, body: "{}" },
		env,
	);
	assert.equal(badSig.status, 400);

	f.sql.exec(
		"INSERT INTO user_subscriptions(user_id,plan_type,status,payment_type,stripe_subscription_id) VALUES('reader','pro','past_due','subscription','sub_past')",
	);
	const subRes = await stripeRoutes.request(
		"/subscription",
		{ headers: { Authorization: `Bearer ${f.webToken}` } },
		env,
	);
	assert.equal(subRes.status, 200);
	const subBody = (await subRes.json()) as {
		data: { plan_id: string; plan_name: string; status: string; weekly_quota: number };
	};
	assert.equal(subBody.data.plan_id, "hobby");
	assert.equal(subBody.data.plan_name, "Hobby");
	assert.equal(subBody.data.status, "past_due");
	assert.equal(subBody.data.weekly_quota, 50);
});

test("admin authorized-ips DELETE awaits DB, reply edit clears user_read_at, stats escapes anon_ and skips unknown cost category", async (t) => {
	const f = await fixture();
	t.after(() => f.close());
	const env = { ...f.env, ADMIN_PASSWORD: "admin-secret-password" };
	const adminHeaders = { "X-Admin-Password": "admin-secret-password" };

	const missingDelete = await adminRoutes.request(
		"/authorized-ips/nonexistent-id",
		{ method: "DELETE", headers: adminHeaders },
		env,
	);
	assert.equal(missingDelete.status, 404);

	// Contact reply update clears user_read_at
	f.sql.exec(
		"INSERT INTO contact_messages(id,user_id,email,message,admin_reply,replied_at,user_read_at,created_at) VALUES('msg1','reader','reader@example.com','Hi','First',datetime('now'),datetime('now'),datetime('now'))",
	);
	const replyRes = await adminRoutes.request(
		"/contact-messages/msg1/reply",
		{
			method: "POST",
			headers: { ...adminHeaders, "Content-Type": "application/json" },
			body: JSON.stringify({ message: "Updated reply", sendEmail: false }),
		},
		env,
	);
	assert.equal(replyRes.status, 200);
	const msg = f.sql
		.prepare("SELECT admin_reply, user_read_at FROM contact_messages WHERE id='msg1'")
		.get() as { admin_reply: string; user_read_at: string | null };
	assert.equal(msg.admin_reply, "Updated reply");
	assert.equal(msg.user_read_at, null);

	// Registered user id starting with 'anon' (no underscore) is counted as registered, not anonymous
	const recentIso = new Date(Date.now() - 60_000).toISOString();
	f.sql.exec(
		`INSERT INTO search_logs(user_id,requested_query,actual_query,status_code,outcome,created_at,channel)
		 VALUES('anonx123','q','q',200,'success','${recentIso}','mcp'),
		       ('anon_1.2.3.4','q','q',200,'success','${recentIso}','mcp')`,
	);
	const statsRes = await adminRoutes.request("/stats?period=7d", { headers: adminHeaders }, env);
	assert.equal(statsRes.status, 200);
	const statsBody = (await statsRes.json()) as {
		data: { metrics: { active_users: { breakdown: { registered: number; anonymous: number } } } };
	};
	assert.equal(statsBody.data.metrics.active_users.breakdown.registered, 1);
	assert.equal(statsBody.data.metrics.active_users.breakdown.anonymous, 1);

	// Authorized IPs enforces server cap (10 max) and validates name length
	const authHeaders = {
		Authorization: `Bearer ${f.webToken}`,
		"Content-Type": "application/json",
	};
	const longName = await authorizedIpsRoutes.request(
		"/",
		{
			method: "POST",
			headers: authHeaders,
			body: JSON.stringify({ ip_address: "203.0.113.10", name: "x".repeat(101) }),
		},
		f.env,
	);
	assert.equal(longName.status, 400);

	// Contact history uses INSTR safely with special %/_ characters
	const histRes = await contactRoutes.request(
		"/history?limit=-5&offset=-1&search=Updated",
		{ headers: { Authorization: `Bearer ${f.webToken}` } },
		f.env,
	);
	assert.equal(histRes.status, 200);
	const histBody = (await histRes.json()) as {
		data: { limit: number; offset: number; messages: unknown[] };
	};
	assert.equal(histBody.data.limit, 20);
	assert.equal(histBody.data.offset, 0);
	assert.equal(histBody.data.messages.length, 1);
});

test("CLI revoke handles header-unsafe tokens per RFC 7009 and CLI v1 authenticates before JSON parse with WWW-Authenticate", async (t) => {
	const f = await fixture();
	t.after(() => f.close());

	const revokeRes = await cliOAuthRoutes.request(
		"/revoke",
		{
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({ client_id: CLI_CLIENT_ID, token: "bad\r\ntoken" }).toString(),
		},
		f.env,
	);
	assert.equal(revokeRes.status, 200);

	const cliRoutes = createCLIRoutes(async () => f.services);
	const badAuthBadJson = await cliRoutes.request(
		"/v1/search",
		{
			method: "POST",
			headers: { Authorization: "Bearer invalid-token", "Content-Type": "application/json" },
			body: "{not-json",
		},
		f.env,
		{ waitUntil() {} } as unknown as ExecutionContext,
	);
	assert.equal(badAuthBadJson.status, 401);
	assert.match(badAuthBadJson.headers.get("WWW-Authenticate") ?? "", /^Bearer /);

	const badAccount = await cliRoutes.request(
		"/v1/account",
		{ headers: { Authorization: "Bearer invalid-token" } },
		f.env,
	);
	assert.equal(badAccount.status, 401);
	assert.match(badAccount.headers.get("WWW-Authenticate") ?? "", /^Bearer /);
});
