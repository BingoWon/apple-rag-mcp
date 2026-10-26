/**
 * Embedding providers with SiliconFlow primary and DeepInfra fallback.
 */

import type { EmbeddingService as IEmbeddingService } from "../mcp-types/index.js";
import { logger } from "../mcp-utils/logger.js";
import { DEEPINFRA_CONFIG, DeepInfraService } from "./deepinfra-base.js";

interface EmbeddingInput {
	text: string;
}

interface EmbeddingPayload {
	model: "Qwen/Qwen3-Embedding-4B";
	input: string;
	encoding_format: "float";
	dimensions?: number;
}

interface EmbeddingResponse {
	data: Array<{
		embedding: number[];
	}>;
}

export class EmbeddingService
	extends DeepInfraService<EmbeddingInput, EmbeddingResponse, number[]>
	implements IEmbeddingService
{
	protected readonly endpoint = "/v1/openai/embeddings";

	/**
	 * Create embedding (single provider)
	 */
	async createEmbedding(text: string, signal?: AbortSignal): Promise<number[]> {
		if (!text?.trim()) {
			throw new Error("Text cannot be empty for embedding generation");
		}

		const input: EmbeddingInput = { text: text.trim() };
		return this.call(input, "Embedding generation", signal);
	}

	/**
	 * Build API payload from request
	 */
	protected buildPayload(input: EmbeddingInput): EmbeddingPayload {
		return {
			model: DEEPINFRA_CONFIG.EMBEDDING_MODEL,
			input: input.text,
			encoding_format: "float",
		};
	}

	/**
	 * Process API response and return normalized embedding
	 */
	protected processResponse(response: EmbeddingResponse, _input: EmbeddingInput): number[] {
		const embedding = this.extractEmbedding(response);
		return this.normalizeL2(embedding);
	}

	/**
	 * Extract embedding from API response
	 */
	private extractEmbedding(response: EmbeddingResponse): number[] {
		const embedding = response.data?.[0]?.embedding;

		if (!embedding || !Array.isArray(embedding)) {
			throw new Error("No embedding data received from DeepInfra API");
		}

		if (embedding.length === 0) {
			throw new Error("Empty embedding received from DeepInfra API");
		}

		return embedding;
	}

	/**
	 * L2 normalization for optimal vector search performance
	 */
	private normalizeL2(embedding: number[]): number[] {
		const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));

		if (norm === 0) {
			logger.warn("Zero norm embedding detected, returning original");
			return [...embedding];
		}

		return embedding.map((val) => val / norm);
	}
}

export class SiliconFlowEmbeddingService extends EmbeddingService {
	protected readonly baseUrl = "https://api.siliconflow.cn";
	protected readonly providerName = "SiliconFlow";

	protected override buildPayload(input: EmbeddingInput): EmbeddingPayload {
		return { ...super.buildPayload(input), dimensions: 2560 };
	}
}

export class FallbackEmbeddingService implements IEmbeddingService {
	constructor(
		private readonly primary: IEmbeddingService,
		private readonly fallback: IEmbeddingService,
	) {}

	async createEmbedding(text: string, signal?: AbortSignal): Promise<number[]> {
		if (!text?.trim()) {
			throw new Error("Text cannot be empty for embedding generation");
		}
		try {
			return await this.primary.createEmbedding(text, signal);
		} catch (error) {
			signal?.throwIfAborted();
			logger.warn(
				`Primary embedding provider failed; using DeepInfra fallback: ${error instanceof Error ? error.message : String(error)}`,
			);
			return this.fallback.createEmbedding(text, signal);
		}
	}
}
