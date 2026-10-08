import assert from "node:assert/strict";
import test from "node:test";
import { OAUTH_SUBSCRIPTION_QUOTAS } from "../api/types/permissions.js";
import type { AuthContext, RateLimitResult, Services } from "../mcp-types/index.js";
import { buildRateLimitMessage } from "../mcp-utils/request-info.js";
import { FREE_ACCESS_GUIDANCE, MESSAGES, PRO_UPGRADE_GUIDANCE } from "./constants.js";
import { formatFetchResponse, formatRAGResponse } from "./formatters/response-formatter.js";
import { FetchTool } from "./tools/fetch-tool.js";
import { SearchTool } from "./tools/search-tool.js";

const NOW = Date.parse("2026-10-08T10:00:20Z");
const RESET = "2026-10-11T00:00:00Z";

function limitedQuota(plan: string, period: "minute" | "weekly"): RateLimitResult {
	const quota = OAUTH_SUBSCRIPTION_QUOTAS[plan];
	return {
		allowed: false,
		planType: plan,
		limitType: period,
		limit: quota.week,
		remaining: 0,
		resetAt: RESET,
		minuteLimit: quota.minute,
		minuteRemaining: 0,
		minuteResetAt: new Date(NOW + 40000).toISOString(),
	};
}

for (const plan of ["anonymous", "hobby", "pro"]) {
	for (const period of ["minute", "weekly"] as const) {
		test(`${plan} ${period} limit returns explicit quotas and appropriate guidance for both tools`, async (t) => {
			t.mock.method(Date, "now", () => NOW);
			const auth: AuthContext =
				plan === "anonymous"
					? { isAuthenticated: false }
					: { isAuthenticated: true, userId: "test" };
			const limited = limitedQuota(plan, period);
			const message = buildRateLimitMessage(limited, auth);

			assert.doesNotMatch(
				message,
				/higher limit|higher search limit|faster responses|priority support/i,
			);
			assert.match(message, /Inform the user of this limit/);
			if (period === "minute") {
				assert.ok(message.includes(`${limited.minuteLimit} tool calls/minute`));
				assert.match(message, /Retry in 40s\./);
			} else {
				assert.ok(message.includes(`${limited.limit.toLocaleString("en-US")} tool calls/week`));
				assert.ok(message.includes(RESET));
			}
			if (plan === "anonymous") {
				assert.ok(message.includes(FREE_ACCESS_GUIDANCE));
				assert.match(message, /50 tool calls\/week and 5 tool calls\/minute/);
				assert.match(message, /https:\/\/apple-rag\.com\/register/);
				assert.match(message, /configure your MCP Token/);
				assert.doesNotMatch(message, /upgrade|subscribe|billing/i);
			} else if (plan === "hobby") {
				assert.ok(message.includes(PRO_UPGRADE_GUIDANCE));
				assert.match(message, /50,000 tool calls\/week and 50 tool calls\/minute/);
				assert.match(message, /https:\/\/apple-rag\.com\/billing/);
				assert.doesNotMatch(message, /hobby/);
			} else {
				assert.doesNotMatch(message, /upgrade|enterprise|register|billing/i);
			}

			const services = { rateLimit: { checkLimits: async () => limited } } as unknown as Services;
			const request = new Request("https://mcp.apple-rag.com", {
				headers: { "cf-connecting-ip": "203.0.113.100" },
			});
			const results = [
				await new SearchTool(services).handle(
					{ query: "SwiftUI NavigationStack", result_count: 4 },
					auth,
					request,
				),
				await new FetchTool(services).handle(
					{ url: "https://developer.apple.com/documentation/swiftui" },
					auth,
					request,
				),
			];
			for (const result of results) {
				assert.equal(result.isError, true);
				assert.deepEqual(result.content, [{ type: "text", text: message }]);
			}
		});
	}
}

test("expired minute windows never produce a negative retry delay", (t) => {
	t.mock.method(Date, "now", () => NOW);
	const limited = limitedQuota("pro", "minute");
	limited.minuteResetAt = new Date(NOW - 1000).toISOString();
	assert.match(buildRateLimitMessage(limited, { isAuthenticated: true }), /Retry in 0s\./);
});

test("anonymous successful results recommend free registration with concrete shared quotas", () => {
	const fetched = { success: true, title: "SwiftUI", content: "Complete SwiftUI documentation." };
	const searched = {
		success: true,
		query: "SwiftUI",
		results: [
			{
				id: "chunk-1",
				url: "https://developer.apple.com/documentation/swiftui",
				title: fetched.title,
				content: fetched.content,
				contentLength: fetched.content.length,
				chunk_index: 0,
				total_chunks: 1,
			},
		],
		count: 1,
		processing_time_ms: 1,
	};
	for (const message of [formatFetchResponse(fetched, false), formatRAGResponse(searched, false)]) {
		assert.ok(message.includes(MESSAGES.ANONYMOUS_ACCESS));
		assert.ok(message.includes(FREE_ACCESS_GUIDANCE));
		assert.match(message, /50 tool calls\/week and 5 tool calls\/minute/);
		assert.match(message, /shared by search and fetch/);
		assert.doesNotMatch(message, /higher limit|upgrade|subscribe|enterprise/i);
	}
	assert.ok(!formatFetchResponse(fetched, true).includes(FREE_ACCESS_GUIDANCE));
	assert.ok(!formatRAGResponse(searched, true).includes(FREE_ACCESS_GUIDANCE));
});
