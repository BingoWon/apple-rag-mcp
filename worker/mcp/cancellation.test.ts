import assert from "node:assert/strict";
import test from "node:test";
import type { Services } from "../mcp-types/index.js";
import { MCPProtocolHandler } from "./protocol-handler.js";
import { FetchTool } from "./tools/fetch-tool.js";
import { SearchTool } from "./tools/search-tool.js";

for (const tool of ["search", "fetch"] as const) {
	for (const stage of ["before-quota", "after-quota", "in-flight"] as const) {
		test(`${tool} cancellation at ${stage} avoids failed-call logs and refunds only reserved quota`, async () => {
			const controller = new AbortController();
			const reason = new Error("User cancelled");
			let reserved = 0;
			let refunded = 0;
			let calls = 0;
			const logs: unknown[] = [];
			const services = {
				rateLimit: {
					checkLimits: async () => {
						reserved++;
						if (stage === "after-quota") controller.abort(reason);
						return { allowed: true };
					},
					refund: async () => {
						refunded++;
					},
				},
				rag: {
					query: async ({ signal }: { signal: AbortSignal }) => {
						assert.equal(signal, controller.signal);
						calls++;
						controller.abort(reason);
						throw reason;
					},
				},
				database: {
					getPageByUrl: async () => {
						calls++;
						controller.abort(reason);
						throw reason;
					},
				},
				logger: {
					logSearch: (entry: unknown) => logs.push(entry),
					logFetch: (entry: unknown) => logs.push(entry),
				},
			} as unknown as Services;
			const request = new Request("https://mcp.apple-rag.com/", {
				signal: controller.signal,
			});
			if (stage === "before-quota") controller.abort(reason);
			const result =
				tool === "search"
					? new SearchTool(services).handle(
							{ query: "Swift", result_count: 1 },
							{ isAuthenticated: false },
							request,
							controller.signal,
						)
					: new FetchTool(services).handle(
							{ url: "https://developer.apple.com/documentation/swift" },
							{ isAuthenticated: false },
							request,
							controller.signal,
						);
			await assert.rejects(result, reason);
			assert.equal(reserved, stage === "before-quota" ? 0 : 1);
			assert.equal(refunded, reserved);
			assert.equal(calls, stage === "in-flight" ? 1 : 0);
			assert.deepEqual(logs, []);
		});
	}
}

test("HTTP cancellation reaches the running tool through the SDK signal", async () => {
	const controller = new AbortController();
	const reason = new Error("User cancelled");
	let observedSignal: AbortSignal | undefined;
	let refunded = false;
	const services = {
		auth: { optionalAuth: async () => ({ isAuthenticated: false }) },
		rateLimit: {
			checkLimits: async () => ({ allowed: true }),
			refund: async () => {
				await new Promise((resolve) => setTimeout(resolve, 1));
				refunded = true;
			},
		},
		rag: {
			query: ({ signal }: { signal: AbortSignal }) =>
				new Promise((_resolve, reject) => {
					observedSignal = signal;
					signal.addEventListener("abort", () => reject(signal.reason), { once: true });
					controller.abort(reason);
				}),
		},
		database: {
			close: async () => {
				assert.equal(refunded, true, "Quota refund must finish before services close");
			},
		},
	} as unknown as Services;
	const response = await new MCPProtocolHandler(() => services).handleRequest(
		new Request("https://mcp.apple-rag.com/", {
			method: "POST",
			signal: controller.signal,
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json, text/event-stream",
				"MCP-Protocol-Version": "2026-07-28",
				"Mcp-Method": "tools/call",
				"Mcp-Name": "search",
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: "cancel",
				method: "tools/call",
				params: {
					_meta: {
						"io.modelcontextprotocol/protocolVersion": "2026-07-28",
						"io.modelcontextprotocol/clientCapabilities": {},
					},
					name: "search",
					arguments: { query: "Swift" },
				},
			}),
		}),
	);
	assert.equal(response.status, 499);
	assert.equal(observedSignal?.aborted, true);
	assert.equal(refunded, true);
});
