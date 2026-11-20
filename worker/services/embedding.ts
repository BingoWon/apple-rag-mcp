import type { Env } from "../shared/types.js";
import type { ModelAlertReporter } from "./model-alerts.js";
import {
	DEEPINFRA_CONFIG,
	ModelRequestError,
	modelTimeout,
	postModelJson,
} from "./model-request.js";
import { type ModelUsageRecorder, pricedModelUsage } from "./model-usage.js";

const EMBEDDING_PRICE_NANOS = { USD: 20, CNY: 140 } as const;
const DIMENSIONS = 2560;

export function embeddingUsage(
	inputTokens: unknown,
	currency: keyof typeof EMBEDDING_PRICE_NANOS = "USD",
) {
	return pricedModelUsage("embedding", inputTokens, currency, EMBEDDING_PRICE_NANOS[currency]);
}

const PROVIDERS = [
	{
		name: "SiliconFlow",
		key: "SILICONFLOW_API_KEY",
		url: "https://api.siliconflow.cn/v1/embeddings",
		currency: "CNY",
	},
	{
		name: "DeepInfra",
		key: "DEEPINFRA_API_KEY",
		url: `${DEEPINFRA_CONFIG.BASE_URL}/v1/openai/embeddings`,
		currency: "USD",
	},
] as const;
type Provider = (typeof PROVIDERS)[number];
interface EmbeddingResponse {
	data?: { embedding?: number[] }[];
	usage?: { prompt_tokens?: number };
}

function normalizedVector(response: EmbeddingResponse) {
	const vector = response?.data?.[0]?.embedding;
	if (
		response?.data?.length !== 1 ||
		!Array.isArray(vector) ||
		vector.length !== DIMENSIONS ||
		!vector.every(Number.isFinite)
	) {
		throw new ModelRequestError("Invalid embedding vector", true);
	}
	const norm = Math.hypot(...vector);
	if (!norm || !Number.isFinite(norm)) throw new ModelRequestError("Invalid embedding norm", true);
	return vector.map((value) => value / norm);
}

function failureOutcome(error: unknown, timeout: AbortSignal, caller?: AbortSignal) {
	if (caller?.aborted) return "cancelled";
	if (timeout.aborted) return "timeout";
	if (error instanceof ModelRequestError && error.status) return "http_error";
	if (error instanceof ModelRequestError || error instanceof SyntaxError) return "invalid_response";
	return "network_error";
}

export class EmbeddingService {
	constructor(
		private readonly env: Pick<Env, Provider["key"]>,
		private readonly reportFailure: ModelAlertReporter,
		private readonly recordUsage?: ModelUsageRecorder,
	) {}

	async createEmbedding(
		text: string,
		signal?: AbortSignal,
		onFallback?: (reason: string) => void,
	): Promise<number[]> {
		signal?.throwIfAborted();
		const input = text?.trim();
		if (!input) throw new Error("Text cannot be empty for embedding generation");

		const budget = modelTimeout(16_000, signal);
		const retryAt = new Map<Provider, number>();
		let attempts = 0;
		let lastError = new Error("No embedding provider is configured");
		for (const timeoutMs of [3_000, 5_000]) {
			for (const provider of PROVIDERS) {
				const apiKey = this.env[provider.key];
				if (!apiKey || budget.aborted || Date.now() < (retryAt.get(provider) ?? 0)) continue;
				if (provider.name === "DeepInfra" && attempts === 1 && this.env.SILICONFLOW_API_KEY)
					onFallback?.("EMBEDDING_FALLBACK");
				const attemptSignal = modelTimeout(timeoutMs, budget);
				const started = Date.now();
				const event = {
					message: "embedding_attempt",
					provider: provider.name,
					attempt: ++attempts,
					timeout_ms: timeoutMs,
				};
				let response: EmbeddingResponse | undefined;
				try {
					response = await postModelJson<EmbeddingResponse>(
						provider.url,
						apiKey,
						{
							model: DEEPINFRA_CONFIG.EMBEDDING_MODEL,
							input,
							encoding_format: "float",
							...(provider.name === "SiliconFlow" ? { dimensions: DIMENSIONS } : {}),
						},
						attemptSignal,
					);
					const vector = normalizedVector(response);
					attemptSignal.throwIfAborted();
					console.log({ ...event, elapsed_ms: Date.now() - started, outcome: "success" });
					return vector;
				} catch (error) {
					const httpStatus = error instanceof ModelRequestError ? error.status : undefined;
					const outcome = failureOutcome(error, attemptSignal, signal);
					console.warn({
						...event,
						elapsed_ms: Date.now() - started,
						outcome,
						http_status: httpStatus,
					});
					signal?.throwIfAborted();
					lastError = error instanceof Error ? error : new Error(String(error));
					if (error instanceof ModelRequestError)
						retryAt.set(provider, error.retryable ? (error.retryAt ?? 0) : Infinity);
					this.reportFailure(
						`embedding:${provider.name}:${httpStatus ?? outcome}`,
						`${provider.name} Embedding generation failed (${httpStatus ?? outcome}).`,
					);
				} finally {
					this.recordUsage?.(embeddingUsage(response?.usage?.prompt_tokens, provider.currency));
				}
			}
		}
		signal?.throwIfAborted();
		if (attempts === 0) this.reportFailure("embedding:config", lastError.message);
		console.warn({ message: "embedding_exhausted", attempts });
		budget.throwIfAborted();
		throw lastError;
	}
}
