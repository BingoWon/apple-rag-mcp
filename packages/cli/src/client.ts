import { z } from "zod";
import {
	accountSchema,
	CLI_CLIENT_ID,
	CLI_RESOURCE,
	CLI_SCOPE,
	type CLICredentials,
	cliCredentialsSchema,
	fetchOutputSchema,
	PLATFORM_URL,
	searchOutputSchema,
} from "../../../shared/contracts.js";
import { CredentialStore, parseToken } from "./credentials.js";
import { CLIError, statusExitCode } from "./errors.js";
import { VERSION } from "./version.js";

export function endpointUrl(value = PLATFORM_URL): string {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new CLIError("INVALID_ENDPOINT", "APPLE_RAG_URL must be the platform HTTPS origin.", 2);
	}
	const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
	if (
		(url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) ||
		url.username ||
		url.password ||
		url.search ||
		url.hash ||
		url.pathname !== "/"
	)
		throw new CLIError(
			"INVALID_ENDPOINT",
			"Use a platform HTTPS origin, or HTTP loopback for testing, without a path, query or credentials.",
			2,
		);
	return url.origin;
}
export class AppleRagClient {
	readonly store: CredentialStore;
	constructor(
		readonly endpoint: string,
		private env: NodeJS.ProcessEnv,
		readonly signal: AbortSignal,
	) {
		this.store = new CredentialStore(endpoint, env);
	}
	private async token(): Promise<string | undefined> {
		if (this.env.APPLE_RAG_TOKEN !== undefined) return parseToken(this.env.APPLE_RAG_TOKEN);
		const saved = await this.store.read();
		if (!saved) return undefined;
		if (Date.parse(saved.expires_at) > Date.now() + 30000) return saved.access_token;
		return this.store.locked(this.signal, async () => {
			const current = await this.store.read();
			if (!current) return undefined;
			if (Date.parse(current.expires_at) > Date.now() + 30000) return current.access_token;
			if (!current.refresh_token)
				throw new CLIError("INVALID_TOKEN", "CLI session expired. Run apple-rag auth login.", 3);
			const refreshed = await this.exchange({
				grant_type: "refresh_token",
				refresh_token: current.refresh_token,
			});
			await this.store.save(refreshed);
			return refreshed.access_token;
		});
	}
	private async request(
		path: string,
		init: RequestInit = {},
		authorized = true,
		timeout = 15000,
	): Promise<Response> {
		const token = authorized ? await this.token() : undefined;
		const response = await fetch(this.endpoint + path, {
			...init,
			redirect: "error",
			signal: AbortSignal.any([this.signal, AbortSignal.timeout(timeout)]),
			headers: {
				"User-Agent": `apple-rag-cli/${VERSION}`,
				"X-Apple-RAG-Version": VERSION,
				...(token ? { Authorization: `Bearer ${token}` } : {}),
				...init.headers,
			},
		});
		return response;
	}
	private async json(path: string, init: RequestInit = {}, timeout = 15000) {
		const response = await this.request(path, init, true, timeout);
		if (!response.ok)
			throw new CLIError(
				response.status === 401 ? "INVALID_TOKEN" : "HTTP_ERROR",
				response.status === 401
					? "CLI credential rejected. Run apple-rag auth login; MCP Tokens are not accepted."
					: `Service returned HTTP ${response.status}.`,
				statusExitCode(response.status),
			);
		return response.json();
	}
	async account() {
		const parsed = accountSchema.safeParse(await this.json(`${CLI_RESOURCE}/account`));
		if (!parsed.success)
			throw new CLIError("INVALID_RESPONSE", "The server returned an invalid account response.");
		return parsed.data;
	}
	async call(tool: "search" | "fetch", args: Record<string, unknown>) {
		const response = await this.request(
			`${CLI_RESOURCE}/${tool}`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(args),
			},
			true,
			45000,
		);
		let body: unknown;
		try {
			body = await response.json();
		} catch {
			throw new CLIError(
				"INVALID_RESPONSE",
				`The service returned HTTP ${response.status} without a valid tool response.`,
				statusExitCode(response.status),
			);
		}
		const parsed = (tool === "search" ? searchOutputSchema : fetchOutputSchema).safeParse(body);
		if (!parsed.success || response.ok !== parsed.data.ok)
			throw new CLIError(
				response.status === 401 ? "INVALID_TOKEN" : "INVALID_RESPONSE",
				response.status === 401
					? "CLI credential rejected. Run apple-rag auth login."
					: "The server returned an invalid tool result.",
				statusExitCode(response.status),
			);
		return parsed.data;
	}
	async exchange(parameters: Record<string, string>): Promise<CLICredentials> {
		const response = await this.request(
			"/oauth/cli/token",
			{
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					client_id: CLI_CLIENT_ID,
					resource: this.endpoint + CLI_RESOURCE,
					...parameters,
				}),
			},
			false,
		);
		const body = await response.json();
		if (!response.ok) {
			const error = z.object({ error: z.string(), error_description: z.string() }).safeParse(body);
			throw new CLIError(
				error.success ? error.data.error : "AUTH_FAILED",
				error.success ? error.data.error_description : "CLI authorization failed.",
				3,
			);
		}
		return cliCredentialsSchema.parse(body);
	}
	async device(name: string) {
		const response = await this.request(
			"/oauth/cli/device/code",
			{
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					client_id: CLI_CLIENT_ID,
					resource: this.endpoint + CLI_RESOURCE,
					scope: CLI_SCOPE,
					device_name: name,
				}),
			},
			false,
		);
		const data = z
			.object({
				device_code: z.string(),
				user_code: z.string(),
				verification_uri: z.url(),
				verification_uri_complete: z.url(),
				expires_in: z.number().positive(),
				interval: z.number().positive(),
			})
			.safeParse(await response.json());
		if (!response.ok || !data.success)
			throw new CLIError("AUTH_FAILED", "Cannot start CLI device authorization.", 3);
		if (new URL(data.data.verification_uri_complete).origin !== this.endpoint)
			throw new CLIError("INVALID_RESPONSE", "Unexpected authorization website.");
		return data.data;
	}
	async revoke(token: string): Promise<void> {
		const response = await this.request(
			"/oauth/cli/revoke",
			{
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({ client_id: CLI_CLIENT_ID, token }),
			},
			false,
		);
		if (!response.ok)
			throw new CLIError(
				"LOGOUT_FAILED",
				"Could not revoke the CLI session. Try again or revoke it in website settings.",
			);
	}
	async logout() {
		await this.store.locked(this.signal, async () => {
			const saved = await this.store.read();
			if (!saved) return;
			await this.revoke(saved.refresh_token ?? saved.access_token);
			await this.store.clear();
		});
	}
	async doctor() {
		const account = await this.account();
		const result = z
			.object({ ok: z.literal(true), channel: z.literal("cli"), operations: z.array(z.string()) })
			.safeParse(await this.json(`${CLI_RESOURCE}/health`));
		if (
			!result.success ||
			!["search", "fetch"].every((name) => result.data.operations.includes(name))
		)
			throw new CLIError("MISSING_TOOLS", "The CLI API must expose search and fetch.");
		return {
			ok: true,
			endpoint: this.endpoint,
			channel: "cli",
			account,
			operations: result.data.operations,
			retrieval_tested: false,
		};
	}
}
