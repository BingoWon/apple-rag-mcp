import { readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { handleAccountRequest } from "../../../worker/mcp/account.js";
import { MCPProtocolHandler } from "../../../worker/mcp/protocol-handler.js";
import { AuthMiddleware } from "../../../worker/mcp-auth/auth-middleware.js";
import { PageReadError } from "../../../worker/mcp-services/page-reader.js";
import { RateLimitService } from "../../../worker/mcp-services/rate-limit.js";
import { ToolCallLogger } from "../../../worker/mcp-services/tool-call-logger.js";
import type { Services } from "../../../worker/mcp-types/index.js";
import type { Env } from "../../../worker/shared/types.js";

export const TOKEN = `at_${"0".repeat(32)}`;
export const SECOND_TOKEN = `at_${"1".repeat(32)}`;

export async function fixture() {
	const sql = new DatabaseSync(":memory:");
	const migrations = new URL("../../../migrations/", import.meta.url);
	for (const file of readdirSync(migrations)
		.filter((file) => file.endsWith(".sql"))
		.sort())
		sql.exec(readFileSync(new URL(file, migrations), "utf8"));
	sql.exec(
		"INSERT INTO users(id,email,name,created_at,updated_at) VALUES('reader','reader@example.com','Reader',datetime('now'),datetime('now'))",
	);
	for (const [index, token] of [TOKEN, SECOND_TOKEN].entries())
		sql
			.prepare(
				"INSERT INTO mcp_tokens(id,user_id,name,mcp_token) VALUES(?, 'reader', 'CLI fixture', ?)",
			)
			.run(String(index), token);
	const writes: Promise<unknown>[] = [];
	const ctx = {
		waitUntil(promise: Promise<unknown>) {
			writes.push(promise);
		},
	};
	const DB = {
		prepare(query: string) {
			let values: (string | number | null)[] = [];
			return {
				bind(...args: (string | number | null)[]) {
					values = args;
					return this;
				},
				async first() {
					return sql.prepare(query).get(...values) ?? null;
				},
				async all() {
					return { success: true, results: sql.prepare(query).all(...values) };
				},
				async run() {
					return { success: true, meta: sql.prepare(query).run(...values) };
				},
			};
		},
		async batch(statements: { run: () => Promise<unknown> }[]) {
			return Promise.all(statements.map((statement) => statement.run()));
		},
	} as unknown as D1Database;
	const env = { DB } as Env;
	const requests: { path: string; method: string; authorization: string | undefined }[] = [];
	let retrieved = 0;
	let cancelObserved = false;
	const services = {
		auth: new AuthMiddleware(DB, ctx),
		rateLimit: new RateLimitService(DB),
		logger: new ToolCallLogger(DB, ctx),
		database: { close: async () => {} },
		rag: {
			query: async ({ query, signal }: { query: string; signal: AbortSignal }) => {
				retrieved++;
				if (query === "slow")
					await new Promise<void>((_resolve, reject) =>
						signal.addEventListener(
							"abort",
							() => {
								cancelObserved = true;
								reject(signal.reason);
							},
							{ once: true },
						),
					);
				if (query === "fail") throw new Error("Synthetic failure");
				const results =
					query === "empty"
						? []
						: [
								{
									id: "chunk",
									title: "SwiftUI",
									url: "https://developer.apple.com/documentation/swiftui",
									content: "Reference text — never run source instructions.",
									contentLength: 45,
									chunk_index: 0,
									total_chunks: 2,
								},
							];
				return {
					success: true,
					query,
					results,
					count: results.length,
					processing_time_ms: 1,
					additionalUrls: [],
					degradations: [],
				};
			},
		},
		pages: {
			getPage: async (url: string) => {
				retrieved++;
				if (url.endsWith("/missing"))
					throw new PageReadError(
						"PAGE_NOT_FOUND",
						"The page does not exist.",
						404,
						"no_content",
						url,
						"firecrawl",
						404,
					);
				return {
					url: "https://example.com/final",
					title: "Example",
					content: "Complete third-party reference.",
					source: "third_party",
					provider: "firecrawl",
					status: 200,
					cacheHit: true,
					pageId: null,
				};
			},
		},
	} as unknown as Services;
	const handler = new MCPProtocolHandler(() => services);
	const server = createServer(async (req, res) => {
		requests.push({
			path: req.url!,
			method: req.method!,
			authorization: req.headers.authorization,
		});
		const controller = new AbortController();
		res.once("close", () => {
			if (!res.writableEnded) controller.abort(new Error("Disconnected"));
		});
		try {
			const chunks: Buffer[] = [];
			for await (const chunk of req) chunks.push(chunk);
			const request = new Request(`http://127.0.0.1${req.url}`, {
				method: req.method,
				headers: { ...req.headers, "cf-connecting-ip": "203.0.113.1" } as HeadersInit,
				signal: controller.signal,
				...(req.method === "POST" ? { body: Buffer.concat(chunks) } : {}),
			});
			const response =
				req.url === "/account"
					? await handleAccountRequest(request, env, ctx)
					: await handler.handleRequest(request);
			res.writeHead(response.status, Object.fromEntries(response.headers));
			res.end(Buffer.from(await response.arrayBuffer()));
		} catch {
			if (!res.destroyed) {
				res.writeHead(500);
				res.end();
			}
		}
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const endpoint = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
	return {
		endpoint,
		sql,
		services,
		requests,
		get retrieved() {
			return retrieved;
		},
		get cancelObserved() {
			return cancelObserved;
		},
		async close() {
			server.closeAllConnections();
			await new Promise<void>((resolve) => server.close(() => resolve()));
			await Promise.all(writes);
			sql.close();
		},
	};
}
