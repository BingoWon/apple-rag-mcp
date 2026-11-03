import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import type { DatabaseService } from "../mcp-types/index.js";
import { PageReadError, PageReader, type StoredWebPage } from "./page-reader.js";

const apple = "https://developer.apple.com/documentation/test";
const external = "https://docs.example.com/Some/Page";
const signal = () => new AbortController().signal;
const document = {
	metadata: { title: "Test API" },
	primaryContentSections: [
		{
			kind: "content",
			content: [
				{ type: "paragraph", inlineContent: [{ type: "text", text: "Official API description." }] },
			],
		},
	],
};

function setup(
	t: TestContext,
	respond: (url: string, init?: RequestInit) => Response | Promise<Response>,
) {
	const calls: string[] = [];
	const cache = new Map<string, StoredWebPage>();
	const indexed = new Map<string, { id: string; url: string; title: string; content: string }>();
	const queued: string[] = [];
	let reservations = 0;
	let allow = true;
	const db = {
		getPageByUrl: async (url: string) => indexed.get(url) ?? null,
		getCachedPage: async (url: string) => cache.get(url) ?? null,
		cachePage: async (url: string, page: StoredWebPage) => {
			cache.set(url, page);
		},
		reserveWebFetch: async () => {
			reservations++;
			return allow;
		},
		enqueuePage: async (url: string) => {
			queued.push(url);
		},
	};
	t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
		const url = String(input);
		assert.equal(
			init?.redirect,
			"manual",
			"Cloudflare Workers require explicit manual redirect checks",
		);
		calls.push(url);
		if (url.startsWith("https://cloudflare-dns.com/"))
			return Response.json({ Status: 0, Answer: [{ type: 1, data: "8.8.8.8" }] });
		return respond(url, init);
	});
	return {
		reader: new PageReader(db as unknown as DatabaseService, {}),
		db,
		calls,
		cache,
		indexed,
		queued,
		deny: () => {
			allow = false;
		},
		reservations: () => reservations,
	};
}

function scrape(status = 200, markdown = "Readable website content.") {
	return Response.json({
		success: true,
		data: { markdown, metadata: { statusCode: status, title: "Page" } },
	});
}

test("indexed content needs no network or provider budget", async (t) => {
	const s = setup(t, () => {
		throw new Error("Network must not run");
	});
	s.indexed.set(apple, { id: "1", url: apple, title: "API", content: "Indexed content" });
	const page = await s.reader.getPage(apple, signal());
	assert.equal(page.provider, "index");
	assert.equal(page.pageId, "1");
	assert.deepEqual(s.calls, []);
});

test("Apple redirects reuse the canonical indexed page and cache the alias", async (t) => {
	const target = `${apple}-new`;
	const s = setup(t, (url) =>
		url === apple
			? new Response(null, { status: 301, headers: { location: target } })
			: new Response("HTML"),
	);
	s.indexed.set(target, { id: "1", url: target, title: "API", content: "Already indexed" });
	const page = await s.reader.getPage(apple, signal());
	assert.equal(page.url, target);
	assert.equal(page.provider, "index");
	assert.equal(s.cache.get(apple)?.url, target);
	assert.equal(s.reservations(), 0);
});

test("missing and empty indexed Apple documents use the existing JSON cleaner and schedule indexing", async (t) => {
	const s = setup(t, (url) =>
		url.endsWith(".json") ? Response.json(document) : new Response("HTML"),
	);
	s.indexed.set(apple, { id: "1", url: apple, title: "", content: "" });
	const page = await s.reader.getPage(apple, signal());
	assert.equal(page.provider, "apple_json");
	assert.match(page.content, /Official API description/);
	assert.deepEqual(s.queued, [apple]);
	assert.equal(s.reservations(), 0);
	assert.equal((await s.reader.getPage(apple, signal())).cacheHit, true);
	assert.equal(s.calls.length, 2);
});

test("JSON unavailable on a valid Apple page uses Firecrawl without changing its Apple origin", async (t) => {
	const s = setup(t, (url) =>
		url.includes("api.firecrawl.dev")
			? scrape()
			: url.endsWith(".json")
				? new Response("Not found", { status: 404 })
				: new Response("HTML"),
	);
	const page = await s.reader.getPage(apple, signal());
	assert.equal(page.provider, "firecrawl");
	assert.equal(page.source, "apple");
	assert.deepEqual(s.queued, []);
});

test("external pages preserve case, identify their origin, cache, and never enter the RAG queue", async (t) => {
	const s = setup(t, (url, init) => {
		assert.equal(url, "https://api.firecrawl.dev/v2/scrape");
		assert.equal(init?.redirect, "manual");
		const body = JSON.parse(String(init?.body));
		assert.equal(body.url, external);
		assert.equal(body.storeInCache, false);
		assert.equal(body.skipTlsVerification, false);
		return scrape();
	});
	const page = await s.reader.getPage(external, signal());
	assert.equal(page.source, "third_party");
	assert.equal(page.provider, "firecrawl");
	assert.equal((await s.reader.getPage(external, signal())).cacheHit, true);
	assert.equal(s.reservations(), 1);
	assert.deepEqual(s.queued, []);
	assert.ok(!s.calls.some((url) => url.startsWith(external)));
});

test("query parameters survive reading and signed URLs stay out of shared caches", async (t) => {
	const s = setup(t, (_url, init) => {
		assert.match(String(init?.body), /token=secret/);
		return scrape();
	});
	await s.reader.getPage(`${external}?token=secret#section`, signal());
	assert.equal(s.cache.size, 0);
});

test("provider HTTP 200 with target 404 is a negative cache entry, never a successful document", async (t) => {
	const s = setup(t, () => scrape(404, "Page not found"));
	for (let i = 0; i < 2; i++)
		await assert.rejects(
			s.reader.getPage(external, signal()),
			(error: unknown) =>
				error instanceof PageReadError &&
				error.reason === "PAGE_NOT_FOUND" &&
				error.outcome === "no_content",
		);
	assert.equal(s.reservations(), 1);
	assert.equal(s.cache.get(external)?.status, 404);
});

test("a genuine Apple 404 is not sent to a paid provider", async (t) => {
	const s = setup(t, () => new Response("Not found", { status: 404 }));
	await assert.rejects(s.reader.getPage(apple, signal()), /does not exist/);
	assert.equal(s.reservations(), 0);
});

test("empty extraction is not cached as a successful page", async (t) => {
	const s = setup(t, () => scrape(200, ""));
	await assert.rejects(s.reader.getPage(external, signal()), /readable content/);
	assert.equal(s.cache.size, 0);
});

test("provider limits, malformed responses and access blocks retain different reasons", async (t) => {
	for (const [response, reason] of [
		[new Response("quota secret", { status: 429 }), "PROVIDER_RATE_LIMITED"],
		[scrape(403), "ACCESS_BLOCKED"],
		[Response.json({ success: true, data: {} }), "PROVIDER_INVALID_RESPONSE"],
	] as const) {
		const s = setup(t, () => response);
		await assert.rejects(
			s.reader.getPage(external, signal()),
			(error: unknown) =>
				error instanceof PageReadError &&
				error.reason === reason &&
				!error.message.includes("secret"),
		);
	}
});

test("the shared daily budget blocks provider calls before spending credits", async (t) => {
	const s = setup(t, () => {
		throw new Error("Provider must not run");
	});
	s.deny();
	await assert.rejects(
		s.reader.getPage(external, signal()),
		(error: unknown) =>
			error instanceof PageReadError && error.reason === "PROVIDER_BUDGET_EXCEEDED",
	);
	assert.equal(s.calls.filter((url) => url.includes("firecrawl")).length, 0);
});

test("invalid URLs and private Apple redirect targets never reach a provider", async (t) => {
	const s = setup(
		t,
		() => new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } }),
	);
	for (const url of [
		"test",
		"http://localhost/a",
		"http://127.0.0.1/",
		"http://2130706433/",
		"https://user:secret@example.com/",
		"ftp://example.com/",
		"https://example.com:8443/",
	]) {
		await assert.rejects(
			s.reader.getPage(url, signal()),
			(error: unknown) => error instanceof PageReadError && error.outcome === "invalid",
		);
	}
	await assert.rejects(s.reader.getPage(apple, signal()), /unsafe address/);
	assert.equal(s.reservations(), 0);
});

test("DNS destinations on private networks are rejected before cloud disclosure", async (t) => {
	const s = setup(t, () => {
		throw new Error("Provider must not run");
	});
	t.mock.method(globalThis, "fetch", async () =>
		Response.json({ Status: 0, Answer: [{ type: 1, data: "10.0.0.1" }] }),
	);
	await assert.rejects(s.reader.getPage(external, signal()), /public website/);
	assert.equal(s.reservations(), 0);
});

test("client cancellation propagates instead of becoming a missing-page or system error", async (t) => {
	const controller = new AbortController();
	const reason = new Error("Cancelled");
	const s = setup(t, () => {
		controller.abort(reason);
		throw reason;
	});
	await assert.rejects(s.reader.getPage(apple, controller.signal), (error) => error === reason);
	assert.equal(s.cache.size, 0);
});

test("DNS service failures are operational failures, not invalid user URLs", async (t) => {
	const s = setup(t, () => {
		throw new Error("Provider must not run");
	});
	t.mock.method(globalThis, "fetch", async () => new Response("Unavailable", { status: 503 }));
	await assert.rejects(
		s.reader.getPage(external, signal()),
		(error: unknown) =>
			error instanceof PageReadError &&
			error.reason === "DNS_LOOKUP_FAILED" &&
			error.outcome === "failed",
	);
	assert.equal(s.reservations(), 0);
});
