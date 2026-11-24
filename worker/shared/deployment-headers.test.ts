import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import packageJson from "../../package.json";
import { apiApp } from "../api/app.js";
import worker from "../index.js";
import type { Env } from "../shared/types.js";

const sitePagesSource = readFileSync(new URL("../site-pages.ts", import.meta.url), "utf8");
const publicHeaders = readFileSync(new URL("../../public/_headers", import.meta.url), "utf8");

const stubCtx = {
	waitUntil() {},
	passThroughOnException() {},
} as unknown as ExecutionContext;

test("public/_headers marks hashed /assets/* immutable for 1 year", () => {
	assert.match(publicHeaders, /^\/assets\/\*/m);
	assert.match(publicHeaders, /Cache-Control:\s*public,\s*max-age=31536000,\s*immutable/);
});

test("sitePage disables browser and CDN HTML caching", () => {
	assert.match(
		sitePagesSource,
		/output\.headers\.set\("Cache-Control",\s*"no-cache, no-store, must-revalidate"\)/,
	);
	assert.match(sitePagesSource, /output\.headers\.set\("CDN-Cache-Control",\s*"no-store"\)/);
});

test("API responses advertise X-App-Version for passive version-skew detection", async () => {
	const res = await apiApp.request("https://apple-rag.com/", undefined, {} as Env);
	assert.equal(res.status, 200);
	assert.equal(res.headers.get("X-App-Version"), packageJson.version);
});

test("missing hashed /assets/* files return uncacheable 404 and /health reports version", async () => {
	const env = {
		ASSETS: {
			fetch: async () => new Response("Not Found", { status: 404 }),
		},
	} as unknown as Env;

	const missingAsset = await worker.fetch(
		new Request("https://apple-rag.com/assets/deleted-chunk-abc123.js"),
		env,
		stubCtx,
	);
	assert.equal(missingAsset.status, 404);
	assert.equal(missingAsset.headers.get("Cache-Control"), "no-store");
	assert.equal(missingAsset.headers.get("CDN-Cache-Control"), "no-store");

	const health = await worker.fetch(new Request("https://apple-rag.com/health"), env, stubCtx);
	assert.equal(health.status, 200);
	assert.equal(health.headers.get("Cache-Control"), "no-store");
	assert.deepEqual(await health.json(), { status: "ok", version: packageJson.version });
});
