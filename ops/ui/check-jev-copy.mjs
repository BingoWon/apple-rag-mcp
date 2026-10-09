import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const server = require("live-server");
const root = fileURLToPath(new URL("../../", import.meta.url));
const results = [];
let browser;
const httpServer = server.start({
	root: `${root}dist/client`,
	host: "127.0.0.1",
	port: 0,
	file: "index.html",
	open: false,
	logLevel: 0,
});
await new Promise((resolve, reject) => {
	httpServer.once("listening", resolve);
	httpServer.once("error", reject);
});
const baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
try {
	browser = await chromium.launch({
		channel: "chrome",
		headless: true,
	});
	for (const viewport of [
		{ width: 768, height: 900 },
		{ width: 1440, height: 900 },
		{ width: 1280, height: 600 },
		{ width: 320, height: 844 },
		{ width: 390, height: 844 },
	]) {
		for (const language of ["en", "zh"]) {
			for (const theme of ["light", "dark"]) {
				const page = await browser.newPage({ viewport, colorScheme: theme });
				const errors = [];
				page.on("pageerror", (error) => errors.push(error.message));
				await page
					.context()
					.route("**/api/**", (route) =>
						route.fulfill({ json: { success: false, error: { message: "Local layout test" } } }),
					);
				await page.addInitScript(
					({ language, theme }) => {
						const user = {
							id: "layout-test",
							name: "Layout Test",
							email: "layout@example.invalid",
							tier: "free",
							permissions: [],
						};
						const payload = {
							sub: user.id,
							name: user.name,
							email: user.email,
							exp: 4_000_000_000,
							plan_type: "free",
							permissions: [],
						};
						const token = `local.${btoa(JSON.stringify(payload))}.layout-test`;
						localStorage.setItem(
							"auth-storage",
							JSON.stringify({ state: { user, token, isAuthenticated: true }, version: 0 }),
						);
						localStorage.setItem("apple-rag-lang", language);
						localStorage.setItem("theme", theme);
						localStorage.setItem("cookie-consent", "declined");
					},
					{ language, theme },
				);
				await page.goto(`${baseUrl}/settings/`, { waitUntil: "networkidle" });
				await page.locator("h1").waitFor();
				const promotion = page.locator(".sidebar-jev:visible");
				assert.equal(await page.locator("div.fixed.inset-y-0.left-0:visible").count(), 0);
				if (viewport.width < 768) {
					await page.locator('svg[class*="menu-2"]:visible').click();
				} else {
					await promotion.waitFor();
					await promotion.locator(".jev-brand-name").waitFor();
					await page.mouse.move(viewport.width - 20, 150);
					await page.waitForTimeout(600);
					assert.equal(
						await promotion.locator(".jev-brand-name").count(),
						1,
						JSON.stringify(
							await promotion.evaluate((element) => ({
								stage: "default-open",
								savedPin: localStorage.getItem("sidebar-pinned"),
								width: element.parentElement.parentElement.getBoundingClientRect().width,
								pinTitle: document.querySelector('button[title*="sidebar"]')?.title,
							})),
						),
					);
					await page.getByRole("button", { name: "Auto-collapse sidebar" }).click();
					await page.mouse.move(viewport.width - 20, 150);
					await page.waitForTimeout(600);
					assert.equal(
						await promotion.locator(".jev-brand-name").count(),
						0,
						JSON.stringify(
							await promotion.evaluate((element) => ({
								savedPin: localStorage.getItem("sidebar-pinned"),
								width: element.parentElement.parentElement.getBoundingClientRect().width,
								hovered: element.parentElement.parentElement.matches(":hover"),
								pinTitle: document.querySelector('button[title*="sidebar"]')?.title,
								point: document.elementFromPoint(window.innerWidth - 20, 150)?.className,
							})),
						),
					);
					assert.equal(await promotion.locator("img").count(), 1);
					await promotion.hover();
				}
				await promotion.locator(".jev-brand-name").waitFor();
				await page.evaluate(() => document.fonts.ready);
				await page.waitForTimeout(600);
				const measured = await promotion.evaluate((element) => {
					const rect = element.getBoundingClientRect();
					const name = element.querySelector(".jev-brand-name");
					const style = getComputedStyle(name);
					const text = element.querySelector("p").getBoundingClientRect();
					const image = element.querySelector("img").getBoundingClientRect();
					const heading = element.querySelector("h2").getBoundingClientRect();
					return {
						title: element.querySelector("h2").textContent,
						subtitle: element.querySelector("p").textContent,
						top: rect.top,
						bottom: rect.bottom,
						left: rect.left,
						right: rect.right,
						textFits:
							text.left >= rect.left && text.right <= rect.right && text.bottom <= rect.bottom,
						headerFits: heading.right <= rect.right && image.right <= heading.left,
						headerCenterDelta: Math.abs(
							image.top + image.height / 2 - heading.top - heading.height / 2,
						),
						fontWeight: style.fontWeight,
						color: style.color,
						shadow: style.textShadow,
						interactions: element.querySelectorAll("a, button").length,
						logoLoaded: element.querySelector("img").naturalWidth > 0,
					};
				});
				assert.ok(measured.title.includes(language === "en" ? "Powered by" : "驱动"));
				assert.ok(!/RAG|Jeff/.test(measured.title + measured.subtitle));
				assert.equal(measured.interactions, 0);
				assert.ok(measured.textFits && measured.headerFits && measured.logoLoaded);
				assert.ok(measured.top >= 0 && measured.bottom <= viewport.height);
				assert.ok(measured.headerCenterDelta < 1);
				assert.equal(measured.fontWeight, "700");
				assert.equal(measured.color, theme === "dark" ? "rgb(255, 255, 255)" : "rgb(15, 23, 42)");
				assert.equal(measured.shadow.match(/\)\s+[\d.]+px\s+[\d.]+px\s+0px/g)?.length, 1);
				const inactive = page.locator('a[href="/mcp-tokens/"]:visible');
				const colors = () =>
					inactive.evaluate((element) => ({
						row: getComputedStyle(element).color,
						icon: getComputedStyle(element.querySelector("svg")).color,
						label: getComputedStyle(element.querySelector(":scope > span")).color,
						weight: getComputedStyle(element.querySelector(":scope > span")).fontWeight,
					}));
				const normal = await colors();
				assert.equal(normal.row, normal.icon);
				assert.equal(normal.row, normal.label);
				assert.equal(normal.weight, "500");
				await inactive.hover();
				await page.waitForTimeout(80);
				const intermediate = await colors();
				assert.equal(intermediate.row, intermediate.icon);
				assert.equal(intermediate.row, intermediate.label);
				await page.waitForTimeout(250);
				const hovered = await colors();
				assert.equal(hovered.row, hovered.icon);
				assert.equal(hovered.row, hovered.label);
				assert.notEqual(hovered.row, normal.row);
				const active = page.locator('a[href="/settings/"]:visible');
				assert.equal(
					await active.evaluate((element) => getComputedStyle(element).backgroundColor),
					"rgb(37, 99, 235)",
				);
				const controls = promotion.locator("..");
				const languageButton = controls.locator('button:has(svg[class*="language"])');
				const themeButton = controls.locator("button:has(svg.absolute)");
				for (const button of [languageButton, themeButton]) {
					const rect = await button.boundingBox();
					assert.equal(rect.width, 36);
					assert.equal(rect.height, 36);
				}
				await languageButton.click();
				await page.waitForTimeout(300);
				assert.ok(
					(await promotion.locator("h2").textContent()).includes(
						language === "en" ? "驱动" : "Powered by",
					),
				);
				await languageButton.click();
				await page.waitForTimeout(300);
				for (let count = 0; count < 3; count++) {
					await themeButton.click();
					await page.waitForTimeout(300);
				}
				assert.equal(await page.evaluate(() => localStorage.getItem("theme")), theme);
				if (viewport.width >= 768) {
					await page.mouse.move(viewport.width - 20, 150);
					await page.waitForTimeout(600);
					assert.equal(await promotion.locator(".jev-brand-name").count(), 0);
					assert.equal(await promotion.locator("img").count(), 1);
					await page.reload({ waitUntil: "networkidle" });
					await promotion.waitFor();
					assert.equal(await promotion.locator(".jev-brand-name").count(), 0);
				} else {
					await page.locator("div.fixed.inset-y-0.left-0:visible button").first().click();
					await page.waitForTimeout(500);
					assert.equal(await page.locator("div.fixed.inset-y-0.left-0:visible").count(), 0);
				}
				const result = {
					viewport,
					language,
					theme,
					sidebar: measured,
					navigation: { normal, intermediate, hovered },
					errors,
				};
				if (viewport.width === 320 || viewport.width === 1440) {
					await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
					await page.locator("#jev").waitFor();
					await page.evaluate(() => document.fonts.ready);
					result.home = await page.locator("#jev").evaluate((element) => {
						const p = element.querySelector("p");
						const style = getComputedStyle(p);
						return {
							title: element.querySelector("h2").textContent,
							subtitle: p.textContent,
							lines: Math.round(p.offsetHeight / parseFloat(style.lineHeight)),
							overflow: element.scrollWidth > window.innerWidth,
						};
					});
					assert.ok(result.home.title.includes(language === "en" ? "Powered by" : "驱动"));
					assert.ok(
						result.home.subtitle.includes(
							language === "en" ? "API, platform, and version" : "API、平台和版本",
						),
					);
					assert.ok(!result.home.overflow);
					if (viewport.width === 1440) assert.equal(result.home.lines, 1);
				}
				assert.deepEqual(errors, []);
				results.push(result);
				console.log(JSON.stringify(result));
				await page.close();
			}
		}
	}
	mkdirSync(new URL("./results/", import.meta.url), { recursive: true });
	writeFileSync(
		new URL("./results/jev-copy.json", import.meta.url),
		JSON.stringify(results, null, 2),
	);
} finally {
	await browser?.close();
	server.shutdown();
}
