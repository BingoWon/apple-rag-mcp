/**
 * Batch Embedding Provider - DeepInfra API
 * True batch API calls with 3x retry, 7s timeout.
 */

import { logger } from "./utils/logger.js";

const DEEPINFRA_CONFIG = {
	API_URL: "https://api.deepinfra.com/v1/openai/embeddings",
	MODEL: "Qwen/Qwen3-Embedding-4B-batch",
	DIMENSION: 2560,
	TIMEOUT_MS: 30_000,
} as const;

export class BatchEmbeddingProvider {
	constructor(private readonly apiKey: string) {
		if (!apiKey) throw new Error("DEEPINFRA_API_KEY is required");
	}

	async encodeBatch(texts: string[]): Promise<number[][]> {
		if (!texts.length) return [];

		let lastError!: Error;

		for (let i = 0; i < 3; i++) {
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
					throw new Error(`API error ${res.status}: ${await res.text().catch(() => "")}`);
				}

				const json = (await res.json()) as {
					data: Array<{ embedding: number[] }>;
				};

				if (json.data?.length !== texts.length) {
					throw new Error(
						`Invalid response: expected ${texts.length} embeddings, got ${json.data?.length || 0}`,
					);
				}

				return json.data.map((item) => this.l2Normalize(item.embedding));
			} catch (e) {
				lastError = e instanceof Error ? e : new Error(String(e));
			}
		}

		await logger.error(
			`Embedding failed after 3 attempts (batch ${texts.length}): ${lastError.message}`,
		);
		throw lastError;
	}

	private l2Normalize(vector: number[]): number[] {
		const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
		return norm === 0 ? vector : vector.map((val) => val / norm);
	}
}

export async function createEmbeddings(texts: string[], apiKey: string): Promise<number[][]> {
	if (!texts.length) return [];
	return new BatchEmbeddingProvider(apiKey).encodeBatch(texts);
}
