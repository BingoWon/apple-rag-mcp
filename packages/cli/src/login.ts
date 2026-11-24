import { spawn } from "node:child_process";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createServer, type ServerResponse } from "node:http";
import { hostname, platform } from "node:os";
import { setTimeout as wait } from "node:timers/promises";
import {
	CLI_CLIENT_ID,
	CLI_RESOURCE,
	CLI_SCOPE,
	type CLICredentials,
} from "../../../shared/contracts.js";
import type { AppleRagClient } from "./client.js";
import { CLIError } from "./errors.js";
import { loginPage } from "./login-page.js";

function openBrowser(url: string): void {
	const [command, args] =
		process.platform === "darwin"
			? ["open", [url]]
			: process.platform === "win32"
				? ["rundll32", ["url.dll,FileProtocolHandler", url]]
				: ["xdg-open", [url]];
	const child = spawn(command, args, { stdio: "ignore" });
	child.on("error", () =>
		process.stderr.write("Open the authorization URL above in your browser.\n"),
	);
	child.unref();
}
async function browserLogin(client: AppleRagClient, browser: boolean, name: string): Promise<void> {
	const state = randomBytes(32).toString("base64url"),
		verifier = randomBytes(32).toString("base64url");
	let complete!: (result: { code: string; redirect: string }) => void,
		fail!: (error: Error) => void;
	const callback = new Promise<{ code: string; redirect: string }>((resolve, reject) => {
		complete = resolve;
		fail = reject;
	});
	let pendingResponse: ServerResponse | undefined,
		language = "en",
		theme: string | undefined,
		received = false;
	const render = (
		response: ServerResponse,
		status: number,
		state: "success" | "denied" | "error",
		lang = language,
		currentTheme = theme,
	) => response.writeHead(status).end(loginPage(state, client.endpoint, lang, currentTheme));
	const server = createServer((request, response) => {
		response.setHeader("Content-Type", "text/html; charset=utf-8");
		response.setHeader("Referrer-Policy", "no-referrer");
		response.setHeader("X-Content-Type-Options", "nosniff");
		response.setHeader(
			"Content-Security-Policy",
			"default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
		);
		const requestLanguage = request.headers["accept-language"]?.startsWith("zh") ? "zh" : "en";
		response.setHeader("Cache-Control", "no-store");
		const local = server.address();
		if (!local || typeof local === "string") {
			render(response, 400, "error", requestLanguage, undefined);
			return;
		}
		const host = local.family === "IPv6" ? "[::1]" : "127.0.0.1";
		const redirect = `http://${host}:${local.port}/callback`;
		let url: URL;
		try {
			url = new URL(request.url ?? "/", redirect);
		} catch {
			render(response, 400, "error", requestLanguage, undefined);
			return;
		}
		const returnedState = url.searchParams.get("state") ?? "";
		if (
			request.method !== "GET" ||
			url.pathname !== "/callback" ||
			request.headers.host !== `${host}:${local.port}` ||
			!/^[A-Za-z0-9_-]{43}$/.test(returnedState) ||
			!timingSafeEqual(Buffer.from(returnedState), Buffer.from(state)) ||
			url.searchParams.get("iss") !== client.endpoint
		) {
			render(response, 400, "error", requestLanguage, undefined);
			return;
		}
		const callbackLanguage = url.searchParams.get("lang") ?? requestLanguage;
		const callbackTheme = url.searchParams.get("theme") ?? undefined;
		if (received) {
			render(response, 409, "error", callbackLanguage, callbackTheme);
			return;
		}
		language = callbackLanguage;
		theme = callbackTheme;
		if (url.searchParams.has("error")) {
			render(response, 403, "denied");
			fail(new CLIError("AUTH_DENIED", "CLI authorization was declined.", 3));
			return;
		}
		const code = url.searchParams.get("code");
		if (!code) {
			render(response, 400, "error");
			return;
		}
		received = true;
		pendingResponse = response;
		complete({ code, redirect });
	});
	server.headersTimeout = 5000;
	server.requestTimeout = 5000;
	server.keepAliveTimeout = 1000;
	const listen = (host: string) =>
		new Promise<void>((resolve, reject) => {
			server.once("error", reject);
			server.listen(0, host, () => {
				server.removeListener("error", reject);
				resolve();
			});
		});
	try {
		await listen("127.0.0.1");
	} catch {
		await listen("::1");
	}
	const address = server.address();
	if (!address || typeof address === "string")
		throw new CLIError("LOGIN_FAILED", "Cannot open the loopback callback.");
	const callbackUrl = `http://${address.family === "IPv6" ? "[::1]" : "127.0.0.1"}:${address.port}/callback`;
	const url = new URL("/oauth/cli/authorize", client.endpoint);
	url.search = new URLSearchParams({
		client_id: CLI_CLIENT_ID,
		response_type: "code",
		redirect_uri: callbackUrl,
		code_challenge: createHash("sha256").update(verifier).digest("base64url"),
		code_challenge_method: "S256",
		state,
		scope: CLI_SCOPE,
		resource: client.endpoint + CLI_RESOURCE,
		device_name: name,
	}).toString();
	const abort = () => fail(new CLIError("CANCELLED", "Login cancelled.", 130));
	client.signal.addEventListener("abort", abort, { once: true });
	try {
		client.signal.throwIfAborted();
		process.stderr.write(`Authorize this CLI device:\n${url.href}\n`);
		if (browser) openBrowser(url.href);
		const result = await callback;
		const credentials = await client.exchange({
			grant_type: "authorization_code",
			code: result.code,
			redirect_uri: result.redirect,
			code_verifier: verifier,
		});
		await saveCredentials(client, credentials);
		if (pendingResponse) render(pendingResponse, 200, "success");
	} catch (error) {
		if (pendingResponse && !pendingResponse.writableEnded) render(pendingResponse, 500, "error");
		throw error;
	} finally {
		client.signal.removeEventListener("abort", abort);
		if (client.signal.aborted) server.closeAllConnections();
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
}
async function deviceLogin(
	client: AppleRagClient,
	browser: boolean,
	name: string,
): Promise<CLICredentials> {
	const request = await client.device(name);
	const expires = Date.now() + request.expires_in * 1000;
	process.stderr.write(
		`Authorize this CLI device:\n${request.verification_uri_complete}\nConfirm code: ${request.user_code}\n`,
	);
	if (browser) openBrowser(request.verification_uri_complete);
	let interval = request.interval;
	while (Date.now() < expires) {
		await wait(interval * 1000, undefined, { signal: client.signal });
		try {
			return await client.exchange({
				grant_type: "urn:ietf:params:oauth:grant-type:device_code",
				device_code: request.device_code,
			});
		} catch (error) {
			if (error instanceof CLIError && error.code === "authorization_pending") continue;
			if (error instanceof CLIError && error.code === "slow_down") {
				interval += 5;
				continue;
			}
			throw error;
		}
	}
	throw new CLIError("AUTH_EXPIRED", "Authorization expired. Run auth login again.", 3);
}
export async function login(
	client: AppleRagClient,
	env: NodeJS.ProcessEnv,
	options: { device: boolean; browser: boolean },
): Promise<void> {
	if (env.APPLE_RAG_TOKEN !== undefined)
		throw new CLIError(
			"ENV_TOKEN_SET",
			"Unset APPLE_RAG_TOKEN before interactive login. It overrides saved CLI sessions.",
			3,
		);
	await client.store.prepare();
	const name = `${hostname()} (${platform()})`.slice(0, 80);
	if (options.device)
		await saveCredentials(client, await deviceLogin(client, options.browser, name));
	else await browserLogin(client, options.browser, name);
}
async function saveCredentials(client: AppleRagClient, credentials: CLICredentials): Promise<void> {
	let previous: CLICredentials | undefined;
	try {
		previous = await client.store.locked(client.signal, async () => {
			const replaced = await client.store.read();
			await client.store.save(credentials);
			return replaced;
		});
	} catch (error) {
		await client.revoke(credentials.refresh_token ?? credentials.access_token).catch(() => {});
		throw error;
	}
	if (previous)
		await client
			.revoke(previous.refresh_token ?? previous.access_token)
			.catch(() =>
				process.stderr.write(
					"The previous CLI session could not be revoked. You can remove it in website settings.\n",
				),
			);
}
