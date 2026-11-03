// Run after build with Playwright on NODE_PATH: node --import tsx ops/ui/check-cli-auth.mjs
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { extname, resolve } from "node:path";
import { loginPage } from "../../packages/cli/src/login-page.ts";

const { chromium } = createRequire(import.meta.url)("playwright");
const root = resolve("dist/client"),
	results = resolve("ops/ui/results/cli-auth");
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
		for (const language of ["zh", "en"])
			for (const theme of ["light", "dark"]) {
				const page = await browser.newPage({
					viewport: { width, height: 900 },
					colorScheme: theme,
				});
				const errors = [];
				page.on("pageerror", (e) => errors.push(e.message));
				await page.route("https://**", (r) => r.abort());
				let releaseApproval = () => {};
				let approvalGate = Promise.resolve();
				let mode = "pending",
					sessions = [
						{
							id: "device",
							name: "MacBook Pro (darwin)",
							kind: "device",
							created_at: Date.now(),
							expires_at: Date.now() + 20 * 86400000,
						},
						{
							id: "ci-key",
							name: "GitHub Actions",
							kind: "api_key",
							created_at: Date.now(),
							expires_at: Date.now() + 7 * 86400000,
						},
					];
				await page.route("**/api/**", async (route) => {
					const r = route.request(),
						url = new URL(r.url());
					if (url.pathname === "/api/cli/authorization") {
						if (r.method() === "POST") {
							await approvalGate;
							return route.fulfill({
								json: { success: true, data: { approved: r.postDataJSON().approve } },
							});
						}
						if (mode === "error") return route.fulfill({ status: 400, json: { success: false } });
						return route.fulfill({
							json: {
								success: true,
								data: {
									client_name: "Apple RAG CLI",
									device_name: "MacBook Pro (darwin)",
									kind: "device",
									status: mode,
									expires_at: new Date(Date.now() + 600000).toISOString(),
									scope: "documents:search documents:fetch",
								},
							},
						});
					}
					if (url.pathname === "/api/cli/sessions") {
						if (r.method() === "POST")
							return route.fulfill({
								json: { success: true, data: { token: "ar_cli_k_LOCAL_LAYOUT_FIXTURE_ONLY" } },
							});
						return route.fulfill({ json: { success: true, data: sessions } });
					}
					if (url.pathname.startsWith("/api/cli/sessions/")) {
						sessions = sessions.filter((s) => s.id !== url.pathname.split("/").at(-1));
						return route.fulfill({ json: { success: true } });
					}
					return route.fulfill({ json: { success: true, data: {} } });
				});
				await page.addInitScript(
					({ language, theme }) => {
						const user = {
							id: "local-layout",
							email: "alex@example.invalid",
							name: "Alex",
							plan_type: "pro",
							permissions: [],
						};
						const token = `local.${btoa(JSON.stringify({ sub: user.id, exp: 4000000000 }))}.local`;
						localStorage.setItem(
							"auth-storage",
							JSON.stringify({ state: { user, token, isAuthenticated: true }, version: 0 }),
						);
						localStorage.setItem("theme", theme);
						localStorage.setItem("apple-rag-lang", language);
						localStorage.setItem("cookie-consent", "declined");
					},
					{ language, theme },
				);
				async function capture(name) {
					await page.waitForTimeout(120);
					await page.screenshot({
						path: `${results}/${name}-${language}-${theme}-${width}.png`,
						fullPage: true,
					});
					const overflow = await page.evaluate(
						() => document.documentElement.scrollWidth > innerWidth,
					);
					if (overflow)
						console.log(
							await page.evaluate(() =>
								Array.from(document.querySelectorAll("*"))
									.filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
									.slice(0, 12)
									.map((e) => ({
										tag: e.tagName,
										classes: e.className,
										right: e.getBoundingClientRect().right,
									})),
							),
						);
					assert(!overflow, `${name} overflows at ${width}`);
					assert.equal(errors.length, 0, errors.join("\n"));
					await page.screenshot({
						path: `${results}/${name}-${language}-${theme}-${width}.png`,
						fullPage: true,
					});
					checks.push({ name, width, language, theme, overflow: false });
				}
				await page.goto(`${base}/cli/authorize?request=layout`, { waitUntil: "networkidle" });
				await page.locator(".auth-identity").waitFor();
				await capture("authorize");
				const main = page.locator(".auth-primary");
				await main.focus();
				assert(await main.evaluate((e) => e.matches(":focus-visible")));
				approvalGate = new Promise((resolve) => {
					releaseApproval = resolve;
				});
				await main.click();
				await page.locator('.auth-primary[aria-busy="true"]').waitFor();
				assert((await main.innerText()).includes(language === "zh" ? "连接 CLI" : "Connect CLI"));
				await capture("authorizing");
				releaseApproval();
				approvalGate = Promise.resolve();
				await page.locator(".auth-status").waitFor();
				await capture("authorized-device");
				mode = "pending";
				await page.goto(`${base}/cli/authorize?user_code=ABCDE-FGHIJ`, {
					waitUntil: "networkidle",
				});
				await page.locator(".auth-code strong").waitFor();
				await capture("device-code");
				await page.locator(".auth-actions .auth-secondary").click();
				await page.locator(".auth-status").waitFor();
				assert(
					(await page.locator(".auth-title").textContent()).includes(
						language === "zh" ? "取消" : "cancelled",
					),
				);
				await capture("denied");
				mode = "error";
				await page.goto(`${base}/cli/authorize?request=expired`, { waitUntil: "networkidle" });
				await page.getByRole("alert").waitFor();
				await capture("expired");
				for (const state of ["success", "denied", "error"]) {
					await page.goto(`${base}/callback/${state}?lang=${language}&theme=${theme}`);
					await capture(`callback-${state}`);
					assert.equal(await page.locator("script").count(), 0);
				}
				await page.goto(`${base}/settings`, { waitUntil: "networkidle" });
				const access = page.locator("#cli-access");
				await access.waitFor();
				await access.scrollIntoViewIfNeeded();
				await capture("settings");
				await access
					.getByRole("button", {
						name: language === "zh" ? "创建 API 密钥" : "Create API key",
						exact: true,
					})
					.click();
				const dialog = page.getByRole("dialog");
				await dialog.waitFor();
				await dialog.getByLabel(language === "zh" ? "密钥名称" : "Key name").fill("GitHub Actions");
				await capture("create-key");
				await dialog
					.getByRole("button", {
						name: language === "zh" ? "创建 API 密钥" : "Create API key",
						exact: true,
					})
					.click();
				await page.getByText("ar_cli_k_LOCAL_LAYOUT_FIXTURE_ONLY").waitFor();
				await capture("key-created");
				await page
					.getByRole("dialog")
					.getByRole("button", { name: language === "zh" ? "关闭" : "Close", exact: true })
					.last()
					.click();
				assert.equal(await page.getByText("ar_cli_k_LOCAL_LAYOUT_FIXTURE_ONLY").count(), 0);
				await access
					.getByRole("button", {
						name:
							language === "zh"
								? "撤销 MacBook Pro (darwin) 的访问"
								: "Revoke access for MacBook Pro (darwin)",
					})
					.click();
				await page
					.getByRole("dialog")
					.getByRole("button", {
						name: language === "zh" ? "撤销访问" : "Revoke access",
						exact: true,
					})
					.click();
				await page.getByRole("dialog").waitFor({ state: "hidden" });
				assert.equal(await access.getByText("MacBook Pro (darwin)", { exact: true }).count(), 0);
				await page.close();
			}
	const guest = await browser.newPage({ viewport: { width: 390, height: 900 } });
	await guest.addInitScript(() => {
		localStorage.setItem("theme", "light");
		localStorage.setItem("apple-rag-lang", "en");
		localStorage.setItem("cookie-consent", "declined");
	});
	await guest.goto(`${base}/cli/authorize?request=needs-login`, { waitUntil: "networkidle" });
	await guest.waitForURL("**/login?return_to=**");
	assert.equal(await guest.locator("input[type=password]").count(), 1);
	await guest.screenshot({ path: `${results}/login-mobile.png`, fullPage: true });
	checks.push({ name: "unauthenticated-return-path" });
	await guest.close();
	await writeFile(`${results}/checks.json`, JSON.stringify(checks, null, 2));
	console.log(`${checks.length} browser layout/interaction checks passed; screenshots: ${results}`);
} finally {
	await browser.close();
	server.closeAllConnections();
	await new Promise((r) => server.close(r));
}
