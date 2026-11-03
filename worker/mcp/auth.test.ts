import assert from "node:assert/strict";
import test from "node:test";
import { AuthMiddleware, MCPAuthenticationError } from "../mcp-auth/auth-middleware.js";

function setup(tokenFound = false, ipFound = false) {
	const lookups: string[] = [];
	const writes: Promise<unknown>[] = [];
	const db = {
		prepare: (sql: string) => ({
			bind: () => ({
				all: async () => {
					lookups.push(sql);
					const found = sql.includes("FROM mcp_tokens") ? tokenFound : ipFound;
					return {
						success: true,
						results: found
							? [{ user_id: "reader", email: "test@example.com", name: "Reader" }]
							: [],
					};
				},
				run: async () => {},
			}),
		}),
	};
	const auth = new AuthMiddleware(db as unknown as D1Database, {
		waitUntil: (p) => writes.push(p),
	});
	return { auth, lookups, writes };
}

test("explicit invalid credentials cannot fall back to an authorized IP and never echo secrets", async (t) => {
	const warnings: string[] = [];
	t.mock.method(console, "warn", (text: string) => warnings.push(text));
	for (const header of [
		"",
		"Basic dummy",
		"Bearer wrong",
		"at_00000000000000000000000000000000",
		"Bearer Bearer at_00000000000000000000000000000000",
		"Bearer at_00000000000000000000000000000000",
	]) {
		const { auth, lookups } = setup(false, true);
		await assert.rejects(
			auth.optionalAuth(
				new Request("https://mcp.apple-rag.com", { headers: { Authorization: header } }),
			),
			MCPAuthenticationError,
		);
		assert.ok(lookups.every((sql) => sql.includes("FROM mcp_tokens")));
	}
	assert.ok(warnings.length > 0);
	assert.doesNotMatch(warnings.join("\n"), /at_|Bearer|Basic/);
});

test("valid token, missing-token IP authentication and anonymous access stay distinct", async () => {
	for (const [tokenFound, ipFound, header, expected] of [
		[true, true, "Bearer at_00000000000000000000000000000000", true],
		[false, true, null, true],
		[false, false, null, false],
	] as const) {
		const { auth, lookups, writes } = setup(tokenFound, ipFound);
		const result = await auth.optionalAuth(
			new Request("https://mcp.apple-rag.com", {
				headers: header ? { Authorization: header } : {},
			}),
		);
		assert.equal(result.isAuthenticated, expected);
		assert.equal(result.token, tokenFound ? header?.slice(7) : ipFound ? "ip-based" : undefined);
		assert.equal(lookups.length, 1);
		await Promise.all(writes);
	}
});
