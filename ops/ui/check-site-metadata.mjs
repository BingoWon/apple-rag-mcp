// Run against a built Worker preview or production: node --import tsx ops/ui/check-site-metadata.mjs BASE_URL
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { getSiteMetadata, SITE_PAGES } from "../../shared/site.ts";

const base = process.argv[2] || "http://127.0.0.1:4304";
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = new URL("./results/site-metadata/", import.meta.url);
await mkdir(results, { recursive: true });
const checks = [];
try {
	const page = await browser.newPage();
	for (const path of [...Object.keys(SITE_PAGES), "/admin/users", "/not-a-real-page"]) {
		const url =
			base +
			path +
			(path.includes("authorize") || path.includes("reset-password")
				? "?state=DO_NOT_REFLECT&token=DO_NOT_REFLECT"
				: "");
		const r = await fetch(url);
		const html = await r.text();
		const expected = getSiteMetadata(path);
		assert.equal(r.status, expected.status, path);
		assert.equal(r.headers.get("x-robots-tag"), expected.robots, path);
		assert(!html.includes("DO_NOT_REFLECT"));
		const actual = await page.evaluate((html) => {
			const doc = new DOMParser().parseFromString(html, "text/html");
			return {
				title: doc.title,
				description: doc.querySelector('meta[name="description"]')?.content,
				ogTitle: doc.querySelector('meta[property="og:title"]')?.content,
				twitterTitle: doc.querySelector('meta[name="twitter:title"]')?.content,
				canonical: doc.querySelector('link[rel="canonical"]')?.getAttribute("href"),
				robots: doc.querySelector('meta[name="robots"]')?.content,
				structured: doc.querySelector('script[type="application/ld+json"]')?.textContent,
			};
		}, html);
		assert.equal(actual.title, expected.title, path);
		assert.equal(actual.description, expected.description, path);
		assert.equal(actual.ogTitle, expected.title, path);
		assert.equal(actual.twitterTitle, expected.title, path);
		assert.equal(actual.canonical ?? undefined, expected.canonical, path);
		assert.equal(actual.robots, expected.robots, path);
		assert.deepEqual(
			actual.structured ? JSON.parse(actual.structured) : undefined,
			expected.structuredData,
			path,
		);
		checks.push({ kind: "raw-html", path });
	}
	for (const path of ["/login/", "/privacy-policy/", "/connect/"]) {
		const r = await fetch(base + path, { headers: { "If-None-Match": "*" } });
		assert.equal(r.status, 200, path);
		assert((await r.text()).includes(getSiteMetadata(path).title));
		checks.push({ kind: "trailing-and-conditional", path });
	}
	const xml = await (await fetch(`${base}/sitemap.xml`)).text();
	assert.equal(
		await page.evaluate(
			(xml) =>
				new DOMParser().parseFromString(xml, "application/xml").querySelectorAll("parsererror")
					.length,
			xml,
		),
		0,
	);
	assert(!xml.includes("/login") && !xml.includes("/register") && !xml.includes("lastmod"));
	const missing = await fetch(`${base}/assets/not-a-real-asset.js`);
	assert.equal(missing.status, 404);
	const reference = await (await fetch(`${base}/api/ui`)).text();
	assert(reference.includes("Apple RAG API Reference"));
	const api = await (await fetch(`${base}/api/doc`)).json();
	assert(api.info.description.includes("MCP and CLI"));
	const robots = await (await fetch(`${base}/robots.txt`)).text();
	assert(!robots.includes("Disallow: /settings"));
	for (const path of ["/connect", "/settings", "/not-a-real-page"]) {
		const h = await fetch(base + path, { method: "HEAD" });
		assert.equal(h.status, getSiteMetadata(path).status);
		assert.equal(h.headers.get("x-robots-tag"), getSiteMetadata(path).robots);
	}
	checks.push({ kind: "sitemap-assets-api-robots-head" });
	await page.close();
	for (const language of ["en", "zh"]) {
		const context = await browser.newContext({
			viewport: { width: 390, height: 900 },
			colorScheme: "light",
		});
		const p = await context.newPage();
		await p.route("https://**", (route) =>
			new URL(route.request().url()).origin === base ? route.continue() : route.abort(),
		);
		await p.route("**/api/**", (route) => route.fulfill({ json: { success: true, data: {} } }));
		await p.addInitScript(
			({ language }) => {
				localStorage.setItem("theme", "light");
				localStorage.setItem("apple-rag-lang", language);
				localStorage.setItem("cookie-consent", "declined");
			},
			{ language },
		);
		for (const path of [
			"/",
			"/connect",
			"/login",
			"/register",
			"/forgot-password",
			"/reset-password?token=local-fixture",
			"/privacy-policy",
			"/terms-of-service",
		]) {
			await p.goto(base + path, { waitUntil: "networkidle" });
			const expected = getSiteMetadata(path, language);
			await p.waitForFunction((title) => document.title === title, expected.title);
			assert.equal(await p.locator("html").getAttribute("lang"), expected.language);
			const data = await p.locator('script[type="application/ld+json"]').allTextContents();
			assert.deepEqual(
				data.length ? JSON.parse(data[0]) : undefined,
				expected.structuredData,
				path,
			);
			checks.push({ kind: "browser", language, path });
		}
		// A real SPA transition must restore tags removed from a private page.
		await p.goto(`${base}/forgot-password`, { waitUntil: "networkidle" });
		await p.locator('form input[type="email"]').fill("reader@example.invalid");
		await p
			.getByRole("button", {
				name: language === "en" ? "Send reset link" : "发送重置链接",
				exact: true,
			})
			.click();
		await p
			.getByRole("heading", { name: language === "en" ? "Check your email" : "请查看邮箱" })
			.waitFor();
		await p.screenshot({ path: new URL(`forgot-success-${language}.png`, results).pathname });
		await p.locator(".auth-brand").click();
		await p.waitForFunction(
			(title) => document.title === title,
			getSiteMetadata("/", language).title,
		);
		assert.equal(await p.locator('script[type="application/ld+json"]').count(), 1);
		assert.equal(
			await p.locator('link[rel="canonical"]').getAttribute("href"),
			"https://apple-rag.com",
		);
		checks.push({ kind: "forgot-and-spa-restore", language });
		await context.close();
	}
	await writeFile(new URL("checks.json", results), JSON.stringify(checks, null, 2));
	console.log(`${checks.length} metadata, discovery and page checks passed against ${base}`);
} finally {
	await browser.close();
}
