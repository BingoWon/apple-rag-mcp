import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import worker from "../index.js";

const executionContext = {
	waitUntil: () => {},
	passThroughOnException: () => {},
} as unknown as ExecutionContext;

test("the Worker enables incoming disconnect signals for protocol cancellation", () => {
	const config = readFileSync(new URL("../../wrangler.toml", import.meta.url), "utf8");
	assert.match(config, /compatibility_flags\s*=\s*\[[^\]]*"enable_request_signal"/);
});

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
					protocolVersion: "2026-07-28",
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

test("rejects legacy MCP protocol versions before service initialization", async () => {
	const response = await worker.fetch(
		new Request("https://mcp.apple-rag.com/", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"MCP-Protocol-Version": "2025-11-25",
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: "legacy",
				method: "server/discover",
				params: {
					_meta: {
						"io.modelcontextprotocol/protocolVersion": "2025-11-25",
						"io.modelcontextprotocol/clientCapabilities": {},
					},
				},
			}),
		}),
		{} as never,
		executionContext,
	);

	assert.equal(response.status, 400);
	const payload = (await response.json()) as {
		id: string;
		error: { code: number; data: { supported: string[]; requested: string } };
	};
	assert.equal(payload.id, "legacy");
	assert.equal(payload.error.code, -32022);
	assert.deepEqual(payload.error.data.supported, ["2026-07-28"]);
	assert.equal(payload.error.data.requested, "2025-11-25");
});

test("requires an explicit MCP protocol version", async () => {
	const response = await worker.fetch(
		new Request("https://mcp.apple-rag.com/", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json, text/event-stream",
				"Mcp-Method": "tools/list",
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 0,
				method: "tools/list",
				params: {
					_meta: {
						"io.modelcontextprotocol/protocolVersion": "2026-07-28",
						"io.modelcontextprotocol/clientCapabilities": {},
					},
				},
			}),
		}),
		{} as never,
		executionContext,
	);

	assert.equal(response.status, 400);
	const payload = (await response.json()) as { id: number; error: { code: number } };
	assert.equal(payload.id, 0);
	assert.equal(payload.error.code, -32020);
});

test("rejects unknown versions with supported revisions on both production endpoints", async () => {
	for (const url of ["https://mcp.apple-rag.com/", "https://apple-rag.com/mcp"]) {
		const completions: Promise<unknown>[] = [];
		const response = await worker.fetch(
			new Request(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json, text/event-stream",
					"MCP-Protocol-Version": "2099-01-01",
					"Mcp-Method": "server/discover",
				},
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: 0,
					method: "server/discover",
					params: {
						_meta: {
							"io.modelcontextprotocol/protocolVersion": "2099-01-01",
							"io.modelcontextprotocol/clientCapabilities": {},
						},
					},
				}),
			}),
			{} as never,
			{
				...executionContext,
				waitUntil: (promise: Promise<unknown>) => completions.push(promise),
			} as unknown as ExecutionContext,
		);
		assert.equal(completions.length, 1);
		await Promise.all(completions);
		assert.equal(response.status, 400);
		const payload = (await response.json()) as {
			id: number;
			error: { code: number; data: { supported: string[]; requested: string } };
		};
		assert.equal(payload.id, 0);
		assert.equal(payload.error.code, -32022);
		assert.deepEqual(payload.error.data, {
			supported: ["2026-07-28"],
			requested: "2099-01-01",
		});
	}
});

test("oversized requests are rejected before creating database services", async () => {
	const response = await worker.fetch(
		new Request("https://mcp.apple-rag.com/", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json, text/event-stream",
				"MCP-Protocol-Version": "2026-07-28",
				"Mcp-Method": "server/discover",
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: "oversized",
				method: "server/discover",
				params: {
					_meta: {
						"io.modelcontextprotocol/protocolVersion": "2026-07-28",
						"io.modelcontextprotocol/clientCapabilities": {},
						"org.example/padding": "x".repeat(4 * 1024 * 1024),
					},
				},
			}),
		}),
		{} as never,
		executionContext,
	);
	assert.equal(response.status, 413);
});
