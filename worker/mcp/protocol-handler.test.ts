import assert from "node:assert/strict";
import test from "node:test";
import type { AuthContext, Services } from "../mcp-types/index.js";
import { MCPProtocolHandler } from "./protocol-handler.js";

const MODERN_VERSION = "2026-07-28";

function createServices(): Services {
	return {
		rag: {
			query: async ({ query }) => ({
				success: true,
				query,
				results: [
					{
						id: "chunk-1",
						url: "https://developer.apple.com/documentation/swift",
						title: "Swift",
						content: "Swift is a powerful programming language.",
						contentLength: 41,
						chunk_index: 0,
						total_chunks: 1,
					},
				],
				additionalUrls: [],
				count: 1,
				processing_time_ms: 1,
			}),
		},
		auth: {
			optionalAuth: async () => ({ isAuthenticated: false }),
		},
		database: {
			semanticSearch: async () => [],
			keywordSearch: async () => [],
			getPageByUrl: async (url) => ({
				id: "page-1",
				url,
				title: "Swift",
				content: "Complete Swift documentation.",
			}),
			close: async () => {},
		},
		embedding: {
			createEmbedding: async () => [],
		},
		rateLimit: {
			checkLimits: async () => ({
				allowed: true,
				limit: 100,
				remaining: 99,
				resetAt: new Date(0).toISOString(),
				planType: "test",
				limitType: "weekly",
			}),
			refund: async () => {},
		},
		logger: {
			logSearch: () => {},
			logFetch: () => {},
		},
	} as unknown as Services;
}

function createRequest(
	body: Record<string, unknown>,
	headers: Record<string, string> = {},
): Request {
	return new Request("https://mcp.apple-rag.com/", {
		method: "POST",
		headers: {
			Accept: "application/json, text/event-stream",
			"Content-Type": "application/json",
			...headers,
		},
		body: JSON.stringify(body),
	});
}

function modernMeta() {
	return {
		"io.modelcontextprotocol/protocolVersion": MODERN_VERSION,
		"io.modelcontextprotocol/clientInfo": {
			name: "apple-rag-test",
			version: "1.0.0",
		},
		"io.modelcontextprotocol/clientCapabilities": {},
	};
}

async function send(
	body: Record<string, unknown>,
	headers?: Record<string, string>,
	authContext: AuthContext = { isAuthenticated: false },
) {
	const services = createServices();
	services.auth.optionalAuth = async () => authContext;
	const handler = new MCPProtocolHandler(() => services);
	return handler.handleRequest(createRequest(body, headers));
}

async function readPayload<T>(response: Response): Promise<T> {
	const body = await response.text();
	if (response.headers.get("content-type")?.includes("application/json")) {
		return JSON.parse(body) as T;
	}

	const messages = body
		.split(/\r?\n/)
		.filter((line) => line.startsWith("data:"))
		.map((line) => JSON.parse(line.slice(5).trim()) as T);

	assert.ok(messages.length > 0, "Expected at least one SSE data message");
	return messages.at(-1) as T;
}

test("serves modern server discovery", async () => {
	const response = await send(
		{
			jsonrpc: "2.0",
			id: "discover",
			method: "server/discover",
			params: { _meta: modernMeta() },
		},
		{
			"MCP-Protocol-Version": MODERN_VERSION,
			"Mcp-Method": "server/discover",
		},
	);

	assert.equal(response.status, 200);
	const payload = await readPayload<{
		result: {
			resultType: string;
			supportedVersions: string[];
			capabilities: { tools: { listChanged: boolean } };
			instructions: string;
			ttlMs: number;
			cacheScope: string;
		};
	}>(response);
	assert.equal(payload.result.resultType, "complete");
	assert.deepEqual(payload.result.supportedVersions, [MODERN_VERSION]);
	assert.equal(payload.result.capabilities.tools.listChanged, false);
	assert.match(payload.result.instructions, /search.*fetch/);
	assert.equal(payload.result.ttlMs, 3_600_000);
	assert.equal(payload.result.cacheScope, "public");
});

test("serves modern tools/list with cache metadata", async () => {
	const response = await send(
		{
			jsonrpc: "2.0",
			id: "tools-list",
			method: "tools/list",
			params: { _meta: modernMeta() },
		},
		{
			"MCP-Protocol-Version": MODERN_VERSION,
			"Mcp-Method": "tools/list",
		},
	);

	assert.equal(response.status, 200);
	const payload = await readPayload<{
		result: {
			resultType: string;
			tools: Array<{
				name: string;
				annotations: { readOnlyHint: boolean; destructiveHint: boolean };
			}>;
			ttlMs: number;
			cacheScope: string;
		};
	}>(response);
	assert.equal(payload.result.resultType, "complete");
	assert.deepEqual(
		payload.result.tools.map((tool) => tool.name),
		["search", "fetch"],
	);
	assert.equal(payload.result.ttlMs, 3_600_000);
	assert.equal(payload.result.cacheScope, "public");
	for (const tool of payload.result.tools) {
		assert.equal(tool.annotations.readOnlyHint, true);
		assert.equal(tool.annotations.destructiveHint, false);
	}
});

test("preserves authenticated tool behavior on a modern request", async () => {
	const response = await send(
		{
			jsonrpc: "2.0",
			id: "tools-call",
			method: "tools/call",
			params: {
				_meta: modernMeta(),
				name: "search",
				arguments: {
					query: "Swift concurrency",
					result_count: 1,
				},
			},
		},
		{
			"MCP-Protocol-Version": MODERN_VERSION,
			"Mcp-Method": "tools/call",
			"Mcp-Name": "search",
		},
		{
			isAuthenticated: true,
			userId: "user-1",
			email: "user@example.com",
			token: "at_00000000000000000000000000000000",
		},
	);

	assert.equal(response.status, 200);
	const payload = await readPayload<{
		result: {
			resultType: string;
			content: Array<{ type: string; text: string }>;
		};
	}>(response);
	assert.equal(payload.result.resultType, "complete");
	assert.equal(payload.result.content[0].type, "text");
	assert.match(payload.result.content[0].text, /Swift is a powerful programming language/);
	assert.doesNotMatch(payload.result.content[0].text, /Anonymous access detected/);
});

test("rejects a modern header and body mismatch", async () => {
	const response = await send(
		{
			jsonrpc: "2.0",
			id: "mismatch",
			method: "tools/list",
			params: { _meta: modernMeta() },
		},
		{
			"MCP-Protocol-Version": MODERN_VERSION,
			"Mcp-Method": "tools/call",
		},
	);

	assert.equal(response.status, 400);
	const payload = await readPayload<{
		error: { code: number };
	}>(response);
	assert.equal(payload.error.code, -32020);
});

test("unsupported tool-list subscriptions acknowledge no notifications and close", async () => {
	const response = await send(
		{
			jsonrpc: "2.0",
			id: "listen",
			method: "subscriptions/listen",
			params: { _meta: modernMeta(), notifications: { toolsListChanged: true } },
		},
		{ "MCP-Protocol-Version": MODERN_VERSION, "Mcp-Method": "subscriptions/listen" },
	);
	assert.equal(response.status, 200);
	const events = (await response.text())
		.split(/\r?\n/)
		.filter((line) => line.startsWith("data:"))
		.map((line) => JSON.parse(line.slice(5)));
	const acknowledged = events.find(
		(event) => event.method === "notifications/subscriptions/acknowledged",
	);
	assert.deepEqual(acknowledged.params.notifications, {});
	assert.equal(events.at(-1).result.resultType, "complete");
});

test("request-scoped services close after successful calls and auth failures", async () => {
	for (const failAuth of [false, true]) {
		const services = createServices();
		let closed = 0;
		services.database.close = async () => {
			closed++;
		};
		if (failAuth) {
			services.auth.optionalAuth = async () => {
				throw new Error("Auth unavailable");
			};
		}
		const handler = new MCPProtocolHandler(() => services);
		const response = await handler.handleRequest(
			createRequest(
				{
					jsonrpc: "2.0",
					id: "close",
					method: "tools/list",
					params: { _meta: modernMeta() },
				},
				{ "MCP-Protocol-Version": MODERN_VERSION, "Mcp-Method": "tools/list" },
			),
		);
		assert.equal(response.status, failAuth ? 500 : 200);
		assert.equal(closed, 1);
	}
});
