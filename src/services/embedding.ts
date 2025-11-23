/**
 * Modern Embedding Service - MCP Optimized
 * DeepInfra API integration (single provider, no fallback)
 */

import type { EmbeddingService as IEmbeddingService } from "../types/index.js";
import { logger } from "../utils/logger.js";
import { DEEPINFRA_CONFIG, DeepInfraService } from "./deepinfra-base.js";

interface EmbeddingInput {
  text: string;
}

interface EmbeddingPayload {
  model: "Qwen/Qwen3-Embedding-4B";
  input: string;
  encoding_format: "float";
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
  async createEmbedding(text: string): Promise<number[]> {
    if (!text?.trim()) {
      throw new Error("Text cannot be empty for embedding generation");
    }

    const input: EmbeddingInput = { text: text.trim() };
    return this.call(input, "Embedding generation");
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
  protected processResponse(
    response: EmbeddingResponse,
    _input: EmbeddingInput
  ): number[] {
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
