/**
 * DeepInfra client utilities (config + base service)
 * Minimal single-key client with retry support.
 */

import packageJson from "../../package.json";
import { logger } from "../mcp-utils/logger.js";
import type { ModelAlertReporter } from "../mcp-utils/model-alerts.js";

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
	) {
		super(message);
	}
}

export abstract class DeepInfraService<TRequest, TResponse, TResult> {
	protected abstract readonly endpoint: string;
	private readonly apiKey: string;

	constructor(
		apiKey: string,
		protected readonly reportFailure: ModelAlertReporter,
	) {
		this.apiKey = apiKey;
	}

	protected async call(
		input: TRequest,
		operationName: string,
		signal?: AbortSignal,
	): Promise<TResult> {
		signal?.throwIfAborted();
		const startTime = Date.now();
		const payload = this.buildPayload(input);
		let lastError!: Error;

		for (let attempt = 1; attempt <= 2; attempt++) {
			try {
				signal?.throwIfAborted();
				const json = await this.singleRequest(this.endpoint, payload, signal);
				logger.info(
					`${operationName} completed (${((Date.now() - startTime) / 1000).toFixed(1)}s)`,
				);
				return this.processResponse(json, input);
			} catch (e) {
				signal?.throwIfAborted();
				lastError = e instanceof Error ? e : new Error(String(e));
				if (attempt === 2 || (e instanceof ModelRequestError && !e.retryable)) {
					break;
				}
				await new Promise((resolve) => setTimeout(resolve, 150));
			}
		}

		this.reportFailure(
			`deepinfra:${this.endpoint}:${lastError instanceof ModelRequestError ? lastError.status : lastError.name}`,
			`DeepInfra ${operationName} failed: ${lastError.message}. Semantic retrieval may fall back to keyword results.`,
		);
		throw lastError;
	}

	protected async singleRequest(
		endpoint: string,
		payload: unknown,
		signal?: AbortSignal,
	): Promise<TResponse> {
		signal?.throwIfAborted();
		if (!this.apiKey) throw new ModelRequestError("DEEPINFRA_API_KEY is not configured", false);
		const res = await fetch(`${DEEPINFRA_CONFIG.BASE_URL}${endpoint}`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
				"Content-Type": "application/json",
				"User-Agent": DEEPINFRA_CONFIG.USER_AGENT,
			},
			body: JSON.stringify(payload),
			signal: signal
				? AbortSignal.any([signal, AbortSignal.timeout(DEEPINFRA_CONFIG.TIMEOUT_MS)])
				: AbortSignal.timeout(DEEPINFRA_CONFIG.TIMEOUT_MS),
		});

		if (!res.ok) {
			const reason = (await res.text().catch(() => ""))
				.replaceAll(this.apiKey, "[REDACTED]")
				.slice(0, 500);
			throw new ModelRequestError(
				`HTTP ${res.status}: ${reason}`,
				res.status === 429 || res.status >= 500,
				res.status,
			);
		}

		return (await res.json()) as TResponse;
	}

	protected abstract buildPayload(input: TRequest): unknown;
	protected abstract processResponse(response: TResponse, input: TRequest): TResult;
}
