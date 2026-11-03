// Run after build with Playwright on NODE_PATH: node --import tsx ops/ui/check-agent-brand.mjs
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { extname, resolve } from "node:path";
import { loginPage } from "../../packages/cli/src/login-page.ts";
import { generateCLIInstallPrompt } from "../../src/utils/agentSetup.ts";
import { generateInstallPrompt } from "../../src/utils/mcpConfigService.ts";

const { chromium } = createRequire(import.meta.url)("playwright");
const root = resolve("dist/client"),
	results = resolve("ops/ui/results/agent-brand");
await mkdir(results, { recursive: true });
const server = createServer(async (req, res) => {
	try {
		const u = new URL(req.url, "http://localhost");
		if (u.pathname.startsWith("/callback/")) {
			res.setHeader("Content-Type", "text/html");
			res.end(
				loginPage(
					u.pathname.split("/").at(-1),
					"https://apple-rag.com",
					u.searchParams.get("lang") || "en",
					u.searchParams.get("theme") || undefined,
				),
			);
			return;
		}
		let file = resolve(root, `.${decodeURIComponent(u.pathname)}`);
		if (!file.startsWith(`${root}/`)) file = `${root}/index.html`;
		if (!extname(file)) file = `${root}/index.html`;
		const bytes = await readFile(file);
		res.setHeader(
			"Content-Type",
			{
				".js": "text/javascript",
				".css": "text/css",
				".html": "text/html",
				".svg": "image/svg+xml",
				".png": "image/png",
				".woff2": "font/woff2",
			}[extname(file)] || "application/octet-stream",
		);
		res.end(bytes);
	} catch {
		res.writeHead(404).end();
	}
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const checks = [];
try {
	for (const width of [390, 1440, 320])
		for (const language of ["en", "zh"])
			for (const theme of ["light", "dark"]) {
				const context = await browser.newContext({
					viewport: { width, height: 1000 },
					colorScheme: theme,
					permissions: ["clipboard-read", "clipboard-write"],
				});
				const page = await context.newPage();
				const errors = [];
				page.on("pageerror", (e) => errors.push(e.message));
				await page.route("https://**", (route) => route.abort());
				await page.route("**/api/**", (route) =>
					route.fulfill({ json: { success: true, data: {} } }),
				);
				await page.addInitScript(
					({ language, theme }) => {
						localStorage.setItem("theme", theme);
						localStorage.setItem("apple-rag-lang", language);
						localStorage.setItem("cookie-consent", "declined");
					},
					{ language, theme },
				);
				async function capture(name) {
					await page.waitForTimeout(150);
					const overflow = await page.evaluate(
						() => document.documentElement.scrollWidth > innerWidth,
					);
					if (overflow)
						console.log(
							await page.evaluate(() =>
								[...document.querySelectorAll("*")]
									.filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
									.slice(0, 8)
									.map((e) => ({
										tag: e.tagName,
										class: e.className,
										right: e.getBoundingClientRect().right,
									})),
							),
						);
					assert(!overflow, `${name} overflows at ${width}`);
					assert.deepEqual(errors, []);
					await page.screenshot({
						path: `${results}/${name}-${language}-${theme}-${width}.png`,
						fullPage: name === "connect" || name === "faq",
					});
					checks.push({ name, language, theme, width });
				}
				await page.goto(base, { waitUntil: "networkidle" });
				await page.locator("#hero h1").waitFor();
				assert(
					(await page.locator("#hero").innerText()).includes(
						language === "en" ? "into AI Agents via MCP / CLI" : "通过 MCP / CLI 注入智能体",
					),
				);
				assert.equal(
					await page.locator('a[href="https://github.com/BingoWon/apple-rag-mcp"]').count(),
					0,
				);
				const heading = page.locator("#hero h1");
				assert((await heading.getAttribute("class")).includes("md:text-7xl"));
				assert((await heading.locator("span[style]").count()) > 10);
				if (language === "en") {
					const rows = await heading
						.locator("span[style]")
						.evaluateAll((letters) => [
							...new Set(letters.map((letter) => Math.round(letter.getBoundingClientRect().top))),
						]);
					assert.equal(rows.length, 1, "Keep the colorful phrase together without orphan letters");
				}
				assert.equal(await page.locator("#hero .arrow-button").count(), 1);
				assert.equal(await page.locator('#hero a[href="/connect"]').count(), 1);
				assert.equal(await page.locator('#hero a[href="/register"]').count(), 1);
				const stickers = await page.locator(".hero-sticker").evaluateAll((items) =>
					items.map((item) => {
						const style = getComputedStyle(item),
							matrix = new DOMMatrixReadOnly(style.transform);
						return {
							left: item.getBoundingClientRect().left,
							top: parseFloat(style.top),
							angle: (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI,
							determinant: matrix.a * matrix.d - matrix.b * matrix.c,
						};
					}),
				);
				assert(stickers[0].left > stickers[1].left, "Person sticker belongs on the right");
				assert.equal(stickers[0].top, width >= 1280 ? 144 : -80);
				assert(Math.abs(stickers[0].angle + 9) < 0.1);
				assert(Math.abs(stickers[1].angle - 11) < 0.1);
				assert(
					stickers.every((item) => item.determinant > 0),
					"Do not mirror either sticker",
				);
				await capture("home");
				await page.locator('#hero a[href="/connect"]').click();
				await page.waitForURL("**/connect");
				await page.goto(base, { waitUntil: "networkidle" });
				const quick = page.locator("#quickstart");
				await quick.scrollIntoViewIfNeeded();
				assert.equal(await quick.getByRole("button").count(), 3);
				assert.equal(await page.locator("#faq").count(), 0);
				for (const mode of ["MCP", "CLI"]) {
					await quick.getByRole("button", { name: mode, exact: true }).click();
					assert.equal(
						await quick
							.getByRole("button", { name: mode, exact: true })
							.getAttribute("aria-pressed"),
						"true",
					);
					const instructions =
						mode === "MCP"
							? generateInstallPrompt({}, language)
							: generateCLIInstallPrompt(language);
					assert.equal(await quick.locator("pre, code, textarea").count(), 0);
					assert(!(await quick.innerText()).includes(instructions));
					assert(
						instructions.includes(
							mode === "MCP" ? "https://mcp.apple-rag.com" : "apple-rag auth login --no-browser",
						),
					);
					await quick
						.getByRole("button", {
							name: language === "en" ? `Copy ${mode} setup instructions` : `复制 ${mode} 接入说明`,
							exact: true,
						})
						.click();
					await page.waitForFunction(
						(text) => navigator.clipboard.readText().then((value) => value === text),
						instructions,
					);
					checks.push({ name: `window-copy-${mode}`, language, theme, width });
				}
				assert(
					(await quick.innerText()).includes(
						language === "en" ? "50,000 calls per week" : "每周 50,000 次调用",
					),
				);
				await capture("connections");
				const testimonials = page.locator("#testimonials");
				await testimonials.scrollIntoViewIfNeeded();
				await expectCarouselName("Jake Mitchell");
				await testimonials
					.getByRole("button", { name: language === "en" ? "Next" : "下一页", exact: true })
					.click();
				await expectCarouselName("Emma O'Sullivan");
				await testimonials
					.getByRole("button", { name: language === "en" ? "Previous" : "上一页", exact: true })
					.click();
				await expectCarouselName("Jake Mitchell");
				async function expectCarouselName(name) {
					await testimonials.getByRole("heading", { name, exact: true }).waitFor();
				}
				await capture("testimonials");
				const cta = page.locator("#cta");
				await cta.scrollIntoViewIfNeeded();
				await page.waitForFunction(() => {
					const words = document.querySelector("#cta .overflow-hidden.pb-2");
					return words && words.clientWidth > 100;
				});
				await page.waitForTimeout(3200);
				assert(
					await cta
						.locator(".overflow-hidden.pb-2")
						.evaluate((words) => words.scrollWidth <= words.clientWidth + 1),
					"Typewriter text must remain fully visible on narrow screens",
				);
				assert.equal(await cta.locator(".arrow-button").count(), 1);
				assert((await cta.innerText()).includes("Vibe Coding"));
				await capture("typewriter-cta");
				await page.goto(`${base}/connect`, { waitUntil: "networkidle" });
				assert.equal(
					await page.locator('link[rel="canonical"]').getAttribute("href"),
					"https://apple-rag.com/connect",
				);
				for (const mode of ["MCP", "CLI"]) {
					await page
						.getByRole("button", {
							name: language === "en" ? `Copy ${mode} setup instructions` : `复制 ${mode} 接入说明`,
							exact: true,
						})
						.click();
					let text = "";
					const marker =
						mode === "MCP" ? "https://mcp.apple-rag.com" : "apple-rag auth login --no-browser";
					for (let attempt = 0; attempt < 30; attempt++) {
						text = await page.evaluate(() => navigator.clipboard.readText());
						if (text.includes(marker)) break;
						await page.waitForTimeout(100);
					}
					assert(
						text.includes(
							mode === "MCP" ? "https://mcp.apple-rag.com" : "apple-rag auth login --no-browser",
						),
					);
					assert(!/Bearer undefined|Bearer null/.test(text));
					if (mode === "CLI") assert(text.includes("skills/apple-dev-docs/SKILL.md"));
					checks.push({ name: `copy-${mode}`, language, theme, width });
				}
				await capture("connect");
				await page.locator("#cli details summary").click();
				assert((await page.locator("#cli").innerText()).includes("apple-rag search"));
				await capture("cli-reference");
				for (const summary of await page.locator("#faq summary").all()) await summary.click();
				await capture("faq");
				await page.goto(`${base}/connect#cli`, { waitUntil: "networkidle" });
				await page.waitForFunction(() => {
					const top = document.getElementById("cli").getBoundingClientRect().top;
					return top >= 0 && top < 200;
				});
				const y = await page.locator("#cli").evaluate((e) => e.getBoundingClientRect().top);
				assert(y >= 0 && y < 200, `CLI anchor at ${y}`);
				checks.push({ name: "cli-anchor", language, theme, width });
				await context.close();
			}
	for (const language of ["en", "zh"]) {
		const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
		const errors = [];
		page.on("pageerror", (e) => errors.push(e.message));
		await page.route("https://**", (r) => r.abort());
		await page.route("**/api/**", (r) =>
			r.fulfill({
				json: {
					success: true,
					data: new URL(r.request().url()).pathname === "/api/mcp-tokens" ? [] : {},
				},
			}),
		);
		await page.addInitScript(
			({ language }) => {
				const user = {
					id: "layout",
					email: "agent-owner@example.invalid",
					name: "Alex",
					plan_type: "pro",
					permissions: [],
				};
				const token = `local.${btoa(JSON.stringify({ sub: user.id, exp: 4000000000 }))}.local`;
				localStorage.setItem(
					"auth-storage",
					JSON.stringify({ state: { user, token, isAuthenticated: true }, version: 0 }),
				);
				localStorage.setItem("theme", "light");
				localStorage.setItem("apple-rag-lang", language);
				localStorage.setItem("cookie-consent", "declined");
			},
			{ language },
		);
		await page.goto(`${base}/overview`, { waitUntil: "networkidle" });
		await page.getByRole("button", { name: "CLI", exact: true }).click();
		await page
			.getByRole("button", {
				name: language === "en" ? "Copy CLI setup instructions" : "复制 CLI 接入说明",
				exact: true,
			})
			.waitFor();
		assert.equal(
			await page.getByRole("button", { name: "CLI", exact: true }).getAttribute("aria-pressed"),
			"true",
		);
		await page.waitForTimeout(250);
		await page.screenshot({ path: `${results}/overview-cli-${language}.png`, fullPage: true });
		checks.push({ name: "dashboard-cli", language });
		await page.getByRole("button", { name: "MCP", exact: true }).click();
		await page
			.getByRole("heading", { name: language === "en" ? "MCP setup" : "MCP 接入", exact: true })
			.waitFor();
		assert.deepEqual(errors, []);
		checks.push({ name: "dashboard-mcp", language });
		await page.goto(base, { waitUntil: "networkidle" });
		await page.locator('#cta a[href="/register"]').click();
		await page.waitForURL("**/register");
		await page.waitForFunction(() => {
			const h = document.querySelector("h1");
			return h && h.getBoundingClientRect().top >= 0;
		});
		checks.push({ name: "footer-cta-scroll", language });
		await page.close();
	}

	await writeFile(`${results}/checks.json`, JSON.stringify(checks, null, 2));
	console.log(`${checks.length} brand/content browser checks passed; screenshots: ${results}`);
} finally {
	await browser.close();
	server.closeAllConnections();
	await new Promise((r) => server.close(r));
}
