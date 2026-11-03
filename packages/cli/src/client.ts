import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { accountSchema, fetchOutputSchema, MCP_URL, searchOutputSchema } from "./contracts.js";
import { CLIError, statusExitCode } from "./errors.js";
import { VERSION } from "./version.js";

export function endpointUrl(value = MCP_URL): string {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new CLIError("INVALID_ENDPOINT", "APPLE_RAG_URL must be an HTTPS MCP endpoint.", 2);
	}
	const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
	if (
		(url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) ||
		url.username ||
		url.password ||
		url.search ||
		url.hash
	) {
		throw new CLIError(
			"INVALID_ENDPOINT",
			"Use HTTPS, or HTTP on loopback for local testing; omit credentials, query and fragment.",
			2,
		);
	}
	return url.href.replace(/\/$/, "");
}

export class AppleRagClient {
	constructor(
		private endpoint: string,
		private token: string | undefined,
		private signal: AbortSignal,
	) {}

	private request = async (
		input: string | URL | Request,
		init?: RequestInit,
	): Promise<Response> => {
		const signal = init?.signal ? AbortSignal.any([this.signal, init.signal]) : this.signal;
		const response = await fetch(input, { ...init, redirect: "error", signal });
		if (!response.ok) {
			throw new CLIError(
				response.status === 401 ? "INVALID_TOKEN" : "HTTP_ERROR",
				response.status === 401
					? "MCP Token rejected. Run apple-rag auth login again; anonymous fallback is disabled."
					: `Service returned HTTP ${response.status}.`,
				statusExitCode(response.status),
			);
		}
		return response;
	};

	private headers(): Record<string, string> {
		return this.token ? { Authorization: `Bearer ${this.token}` } : {};
	}

	async account() {
		const response = await this.request(`${this.endpoint}/account`, { headers: this.headers() });
		const parsed = accountSchema.safeParse(await response.json());
		if (!parsed.success)
			throw new CLIError(
				"INVALID_RESPONSE",
				"The server returned an invalid account response. Update the CLI or contact support.",
			);
		return parsed.data;
	}

	private async connected<T>(action: (client: Client) => Promise<T>): Promise<T> {
		const client = new Client(
			{ name: "apple-rag-cli", version: VERSION },
			{ versionNegotiation: { mode: "auto", probe: { timeoutMs: 15000, maxRetries: 0 } } },
		);
		const transport = new StreamableHTTPClientTransport(new URL(this.endpoint), {
			requestInit: { headers: this.headers() },
			fetch: this.request,
		});
		try {
			await client.connect(transport, { signal: this.signal, timeout: 15000 });
			return await action(client);
		} catch (error) {
			if (error instanceof Error && error.cause instanceof CLIError) throw error.cause;
			throw error;
		} finally {
			await client.close();
		}
	}

	async call(tool: "search" | "fetch", args: Record<string, unknown>) {
		return this.connected(async (client) => {
			const result = await client.callTool(
				{ name: tool, arguments: args },
				{ signal: this.signal, timeout: 45000 },
			);
			const parsed = (tool === "search" ? searchOutputSchema : fetchOutputSchema).safeParse(
				result.structuredContent,
			);
			if (!parsed.success || Boolean(result.isError) === parsed.data.ok) {
				throw new CLIError(
					"INVALID_RESPONSE",
					"The server returned an invalid tool result. Update the CLI or contact support.",
				);
			}
			return parsed.data;
		});
	}

	async doctor() {
		const account = await this.account();
		const tools = await this.connected(async (client) =>
			(await client.listTools({}, { signal: this.signal, timeout: 15000 })).tools.map(
				(tool) => tool.name,
			),
		);
		if (!["search", "fetch"].every((name) => tools.includes(name)))
			throw new CLIError("MISSING_TOOLS", "The server must expose search and fetch.");
		return { ok: true, endpoint: this.endpoint, account, tools, retrieval_tested: false };
	}
}
