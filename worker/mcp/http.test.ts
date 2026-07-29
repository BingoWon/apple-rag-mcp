import assert from "node:assert/strict";
import test from "node:test";
import worker from "../index.js";

const executionContext = {
	waitUntil: () => {},
	passThroughOnException: () => {},
} as unknown as ExecutionContext;

test("allows production browser origins and modern MCP headers", async () => {
	const response = await worker.fetch(
		new Request("https://mcp.apple-rag.com/", {
			method: "OPTIONS",
			headers: {
				Origin: "https://apple-rag.com",
				"Access-Control-Request-Method": "POST",
				"Access-Control-Request-Headers":
					"content-type,authorization,mcp-protocol-version,mcp-method,mcp-name",
			},
		}),
		{} as never,
		executionContext,
	);

	assert.equal(response.status, 204);
	assert.equal(response.headers.get("access-control-allow-origin"), "https://apple-rag.com");
	assert.match(response.headers.get("access-control-allow-headers") ?? "", /Mcp-Method/);
	assert.match(response.headers.get("access-control-allow-headers") ?? "", /Mcp-Name/);
});

test("rejects an untrusted Origin before service initialization", async () => {
	const response = await worker.fetch(
		new Request("https://mcp.apple-rag.com/", {
			method: "POST",
			headers: {
				Origin: "https://example.invalid",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: "origin",
				method: "initialize",
				params: {
					protocolVersion: "2025-11-25",
					capabilities: {},
					clientInfo: { name: "apple-rag-test", version: "1.0.0" },
				},
			}),
		}),
		{} as never,
		executionContext,
	);

	assert.equal(response.status, 403);
	const payload = (await response.json()) as {
		error: { message: string };
	};
	assert.match(payload.error.message, /Invalid Origin/);
});
