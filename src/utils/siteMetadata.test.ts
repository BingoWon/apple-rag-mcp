import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createRoutesFromChildren } from "react-router-dom";
import { getSiteMetadata, SITE_PAGES, siteSitemap, siteStructuredJSON } from "../../shared/site";
import { AppRouter } from "../router";

const routes = createRoutesFromChildren(AppRouter().props.children.props.children);
test("every frontend route has intentional metadata instead of a homepage fallback", () => {
	for (const route of routes) {
		if (!route.path || route.path === "*") continue;
		const page = getSiteMetadata(route.path);
		assert.equal(page.status, 200, route.path);
		assert.ok(SITE_PAGES[route.path], route.path);
		assert.match(page.title, /Apple RAG/);
		if (route.path !== "/") assert.notEqual(page.title, SITE_PAGES["/"].title);
	}
	assert.equal(getSiteMetadata("/admin/users").title, SITE_PAGES["/admin"].title);
});
test("only public content is indexed and listed in the sitemap", () => {
	const publicPaths = ["/", "/connect", "/updates", "/privacy-policy", "/terms-of-service"];
	const sitemap = siteSitemap();
	for (const [path, page] of Object.entries(SITE_PAGES)) {
		const meta = getSiteMetadata(path);
		assert.equal(page.indexable, publicPaths.includes(path), path);
		assert.equal(meta.robots, page.indexable ? "index, follow" : "noindex, nofollow");
		assert.equal(!!meta.structuredData, page.indexable, path);
		assert.equal(
			sitemap.includes(`<loc>https://apple-rag.com${path === "/" ? "/" : path}</loc>`),
			page.indexable,
		);
	}
	assert(!sitemap.includes("lastmod"));
});
test("canonical and structured data are route-specific and never contain authorization parameters", () => {
	for (const path of ["/login/", "/reset-password", "/cli/authorize", "/settings"]) {
		const page = getSiteMetadata(`${path}?token=PRIVATE&state=PRIVATE#PRIVATE`);
		assert(!JSON.stringify(page).includes("PRIVATE"));
		assert.equal(page.canonical, `https://apple-rag.com${path.replace(/\/$/, "")}`);
	}
	const connect = getSiteMetadata("/connect/");
	assert.equal(connect.structuredData?.["@type"], "WebPage");
	assert.equal(connect.structuredData?.url, "https://apple-rag.com/connect");
	assert.equal(
		getSiteMetadata("/privacy-policy").structuredData?.name,
		"Privacy Policy — Apple RAG",
	);
	const missing = getSiteMetadata("/does-not-exist?token=PRIVATE");
	assert.equal(missing.status, 404);
	assert.equal(missing.canonical, undefined);
	assert.equal(missing.structuredData, undefined);
	assert.equal(missing.robots, "noindex, nofollow");
});
test("metadata language matches available page copy and safely serializes JSON-LD", () => {
	assert.match(getSiteMetadata("/connect", "zh-CN").title, /接入/);
	assert.equal(getSiteMetadata("/connect", "zh-CN").locale, "zh_CN");
	assert.equal(getSiteMetadata("/privacy-policy", "zh").language, "en");
	const encoded = siteStructuredJSON({ description: '</script><script>alert("bad")</script>' });
	assert(!encoded.includes("<"));
	assert.deepEqual(JSON.parse(encoded), { description: '</script><script>alert("bad")</script>' });
	const index = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
	const data = JSON.parse(
		index.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)![1],
	);
	assert.deepEqual(data, getSiteMetadata("/").structuredData);
});
