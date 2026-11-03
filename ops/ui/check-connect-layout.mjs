// Run against a built Worker preview or production, with Playwright on NODE_PATH.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const base = process.argv[2] || "http://127.0.0.1:4305";
const { chromium } = createRequire(import.meta.url)("playwright");
const results = new URL("./results/connect-layout/", import.meta.url);
await mkdir(results, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const checks = [];
try {
	for (const width of [320, 390, 768, 1440])
		for (const language of ["en", "zh"])
			for (const theme of ["light", "dark"]) {
				const context = await browser.newContext({
					viewport: { width, height: 1000 },
					colorScheme: theme,
					permissions: ["clipboard-read", "clipboard-write"],
				});
				const page = await context.newPage();
				const errors = [];
				page.on("pageerror", (error) => errors.push(error.message));
				await page.route("https://**", (route) =>
					new URL(route.request().url()).origin === base ? route.continue() : route.abort(),
				);
				await page.route("**/api/**", (route) =>
					route.fulfill({ json: { success: true, data: {} } }),
				);
				await page.addInitScript(
					({ language, theme }) => {
						localStorage.setItem("apple-rag-lang", language);
						localStorage.setItem("theme", theme);
						localStorage.setItem("cookie-consent", "declined");
					},
					{ language, theme },
				);
				await page.goto(`${base}/connect`, { waitUntil: "networkidle" });
				assert.deepEqual(await page.locator("main > div h3").allTextContents(), ["MCP", "CLI"]);
				const sizes = await page.evaluate(() => {
					const box = (selector) => {
						const r = document.querySelector(selector).getBoundingClientRect();
						return { left: r.left, width: r.width };
					};
					return {
						main: box("main"),
						parts: ["main > header", "main > div", "#mcp", "#cli", "#faq"].map(box),
					};
				});
				assert.equal(sizes.main.width, Math.min(width, 768));
				for (const part of sizes.parts) {
					assert(Math.abs(part.left - sizes.parts[0].left) < 1);
					assert(Math.abs(part.width - (sizes.main.width - 48)) < 1);
				}
				assert.equal(await page.locator("#cli aside").count(), 1);
				assert.equal(await page.locator("main > aside").count(), 0);
				for (const mode of ["MCP", "CLI"]) {
					await page
						.getByRole("button", {
							name: language === "en" ? `Copy ${mode} setup instructions` : `复制 ${mode} 接入说明`,
							exact: true,
						})
						.click();
					const marker =
						mode === "MCP" ? "https://mcp.apple-rag.com" : "apple-rag auth login --no-browser";
					await page.waitForFunction(
						(marker) => navigator.clipboard.readText().then((text) => text.includes(marker)),
						marker,
					);
				}
				await page.locator("#cli details summary").click();
				assert((await page.locator("#cli details").innerText()).includes("apple-rag search"));
				const questions = await page.locator("#faq summary").allTextContents();
				assert.equal(questions.length, 5);
				for (const index of [0, 1, 2, 4])
					assert(questions[index].includes("MCP") && questions[index].includes("CLI"));
				for (const summary of await page.locator("#faq summary").all()) await summary.click();
				assert.equal(await page.locator("#faq details[open]").count(), 5);
				assert.equal(
					await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
					false,
				);
				assert.deepEqual(errors, []);
				await page.getByRole("status").first().waitFor({ state: "hidden" });
				await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
				await page.waitForTimeout(250);
				await page.screenshot({
					path: new URL(`${language}-${theme}-${width}.png`, results).pathname,
					fullPage: true,
				});
				await page
					.locator("#faq")
					.screenshot({ path: new URL(`faq-${language}-${theme}-${width}.png`, results).pathname });
				for (const mode of ["mcp", "cli"]) {
					await page.goto(`${base}/connect#${mode}`, { waitUntil: "networkidle" });
					await page.waitForFunction((mode) => {
						const top = document.getElementById(mode).getBoundingClientRect().top;
						return top >= 0 && top < 200;
					}, mode);
				}
				checks.push({ width, language, theme, contentWidth: sizes.parts[0].width });
				await context.close();
			}
	await writeFile(new URL("checks.json", results), JSON.stringify({ base, checks }, null, 2));
	console.log(
		`${checks.length} connection-guide layout and interaction cases passed against ${base}`,
	);
} finally {
	await browser.close();
}
