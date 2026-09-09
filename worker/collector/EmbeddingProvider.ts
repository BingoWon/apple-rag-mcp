/**
 * Embedding Provider - DeepInfra API
 * Batched input requests against the standard embedding model with retry support.
 */

import { logger } from "./utils/logger.js";

const DEEPINFRA_CONFIG = {
	API_URL: "https://api.deepinfra.com/v1/openai/embeddings",
	MODEL: "Qwen/Qwen3-Embedding-4B",
	DIMENSION: 2560,
	TIMEOUT_MS: 30_000,
	BATCH_SIZE: 32,
	CONCURRENCY: 1,
	MAX_ATTEMPTS: 5,
	RETRY_BASE_DELAY_MS: 1_000,
	RETRY_MAX_DELAY_MS: 30_000,
} as const;

class EmbeddingRequestError extends Error {
	constructor(
		message: string,
		readonly retryable: boolean,
		readonly retryAfterMs?: number,
	) {
		super(message);
	}
}

export class BatchEmbeddingProvider {
	constructor(private readonly apiKey: string) {
		if (!apiKey) throw new Error("DEEPINFRA_API_KEY is required");
	}

	async encodeBatch(texts: string[]): Promise<number[][]> {
		if (!texts.length) return [];

		let lastError!: Error;

		for (let attempt = 1; attempt <= DEEPINFRA_CONFIG.MAX_ATTEMPTS; attempt++) {
			try {
				const res = await fetch(DEEPINFRA_CONFIG.API_URL, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${this.apiKey}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						model: DEEPINFRA_CONFIG.MODEL,
						input: texts,
						encoding_format: "float",
					}),
					signal: AbortSignal.timeout(DEEPINFRA_CONFIG.TIMEOUT_MS),
				});

				if (!res.ok) {
					throw new EmbeddingRequestError(
						`API error ${res.status}: ${await res.text().catch(() => "")}`,
						res.status === 429 || res.status >= 500,
						parseRetryAfter(res.headers.get("retry-after")),
					);
				}

				const json = (await res.json()) as {
					data: Array<{ embedding: number[]; index: number }>;
				};

				if (json.data?.length !== texts.length) {
					throw new Error(
						`Invalid response: expected ${texts.length} embeddings, got ${json.data?.length || 0}`,
					);
				}

				const ordered = [...json.data].sort((a, b) => a.index - b.index);
				if (
					ordered.some(
						(item, index) =>
							item.index !== index || item.embedding.length !== DEEPINFRA_CONFIG.DIMENSION,
					)
				) {
					throw new Error("Invalid embedding indices or dimensions");
				}

				return ordered.map((item) => this.l2Normalize(item.embedding));
			} catch (e) {
				lastError = e instanceof Error ? e : new Error(String(e));
				if (
					attempt === DEEPINFRA_CONFIG.MAX_ATTEMPTS ||
					(e instanceof EmbeddingRequestError && !e.retryable)
				) {
					break;
				}

				const retryAfterMs = e instanceof EmbeddingRequestError ? e.retryAfterMs : undefined;
				const delayMs =
					retryAfterMs ??
					Math.min(
						DEEPINFRA_CONFIG.RETRY_MAX_DELAY_MS,
						DEEPINFRA_CONFIG.RETRY_BASE_DELAY_MS * 2 ** (attempt - 1),
					);
				await new Promise((resolve) => setTimeout(resolve, delayMs));
			}
		}

		logger.warn(`Embedding failed (batch ${texts.length}): ${lastError.message}`);
		throw lastError;
	}

	private l2Normalize(vector: number[]): number[] {
		const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
		return norm === 0 ? vector : vector.map((val) => val / norm);
	}
}

function parseRetryAfter(value: string | null): number | undefined {
	if (!value) return undefined;
	const seconds = Number(value);
	return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1_000 : undefined;
}

export async function createEmbeddings(texts: string[], apiKey: string): Promise<number[][]> {
	if (!texts.length) return [];

	const provider = new BatchEmbeddingProvider(apiKey);
	const batches = Array.from(
		{ length: Math.ceil(texts.length / DEEPINFRA_CONFIG.BATCH_SIZE) },
		(_, index) => {
			const start = index * DEEPINFRA_CONFIG.BATCH_SIZE;
			return { start, texts: texts.slice(start, start + DEEPINFRA_CONFIG.BATCH_SIZE) };
		},
	);
	const embeddings = new Array<number[]>(texts.length);
	let nextBatch = 0;

	async function worker(): Promise<void> {
		while (nextBatch < batches.length) {
			const batch = batches[nextBatch++];
			const encoded = await provider.encodeBatch(batch.texts);
			encoded.forEach((embedding, index) => {
				embeddings[batch.start + index] = embedding;
			});
		}
	}

	await Promise.all(
		Array.from({ length: Math.min(DEEPINFRA_CONFIG.CONCURRENCY, batches.length) }, () => worker()),
	);

	return embeddings;
}
