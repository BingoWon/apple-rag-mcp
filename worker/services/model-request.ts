import packageJson from "../../package.json";

export const DEEPINFRA_CONFIG = {
	BASE_URL: "https://api.deepinfra.com",
	TIMEOUT_MS: 5_000,
	USER_AGENT: `Apple-RAG-MCP/${packageJson.version}`,
	EMBEDDING_MODEL: "Qwen/Qwen3-Embedding-4B",
	RERANKER_MODEL: "Qwen/Qwen3-Reranker-8B",
} as const;

export class ModelRequestError extends Error {
	constructor(
		message: string,
		readonly retryable: boolean,
		readonly status?: number,
		readonly retryAt?: number,
	) {
		super(message);
	}
}

export function modelTimeout(timeoutMs: number, parent?: AbortSignal) {
	const timeout = AbortSignal.timeout(timeoutMs);
	return parent ? AbortSignal.any([parent, timeout]) : timeout;
}

export function modelResponseIds(response: Response): string {
	const requestId = response.headers.get("x-request-id") ?? response.headers.get("request-id");
	const ray = response.headers.get("cf-ray");
	return [
		requestId && /^[a-zA-Z0-9._:-]{1,128}$/.test(requestId)
			? `upstream_request_id=${requestId}`
			: "",
		ray && /^[a-f0-9]{16}(?:-[A-Z]{3})?$/i.test(ray) ? `upstream_ray=${ray}` : "",
	]
		.filter(Boolean)
		.join(" ");
}

export async function postModelJson<T>(
	url: string,
	apiKey: string,
	payload: unknown,
	signal: AbortSignal,
	onResponse?: (response: Response) => void,
): Promise<T> {
	signal.throwIfAborted();
	const res = await fetch(url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
			"User-Agent": DEEPINFRA_CONFIG.USER_AGENT,
		},
		body: JSON.stringify(payload),
		signal,
	});
	onResponse?.(res);
	if (!res.ok) {
		const after = res.headers.get("Retry-After");
		const retryAt = !after
			? undefined
			: /^\d+$/.test(after)
				? Date.now() + Number(after) * 1000
				: Date.parse(after);
		const reason = (await res.text().catch(() => ""))
			.replaceAll(apiKey, "[REDACTED]")
			.slice(0, 500);
		throw new ModelRequestError(
			`HTTP ${res.status}: ${reason}`,
			res.status === 408 || res.status === 429 || res.status >= 500,
			res.status,
			retryAt,
		);
	}
	return (await res.json()) as T;
}
