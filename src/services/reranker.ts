/**
 * DeepInfra Reranker Service - MCP Optimized
 * Single provider reranking (no fallback)
 */

import { logger } from "../utils/logger.js";
import { DeepInfraService } from "./deepinfra-base.js";

interface RerankerInput {
  query: string;
  documents: string[];
  topN: number;
}

interface RerankerPayload {
  queries: [string];
  documents: string[];
  top_n: number;
}

export interface RerankerResponse {
  scores: number[];
}

export interface RankedDocument {
  content: string;
  originalIndex: number;
  relevanceScore: number;
}

export class RerankerService extends DeepInfraService<
  RerankerInput,
  RerankerResponse,
  RankedDocument[]
> {
  protected readonly endpoint = "/v1/inference/Qwen/Qwen3-Reranker-8B";

  /**
   * Rerank documents based on query relevance
   */
  async rerank(
    query: string,
    documents: string[],
    topN: number
  ): Promise<RankedDocument[]> {
    if (!query?.trim()) {
      throw new Error("Query cannot be empty for reranking");
    }

    if (!documents || documents.length === 0) {
      throw new Error("Documents cannot be empty for reranking");
    }

    // Validate topN parameter
    const validTopN = Math.min(topN, documents.length);
    if (validTopN <= 0) {
      throw new Error("top_n must be greater than 0");
    }

    const input: RerankerInput = {
      query: query.trim(),
      documents,
      topN: validTopN,
    };

    return this.call(input, "Document reranking");
  }

  /**
   * Build API payload from input
   */
  protected buildPayload(input: RerankerInput): RerankerPayload {
    return {
      queries: [input.query],
      documents: input.documents,
      top_n: input.topN,
    };
  }

  /**
   * Process API response and return ranked documents
   */
  protected processResponse(
    response: RerankerResponse,
    input: RerankerInput
  ): RankedDocument[] {
    if (!response.scores || response.scores.length === 0) {
      throw new Error("No reranking results received from DeepInfra API");
    }

    const scores = response.scores;
    const count = Math.min(input.topN, scores.length, input.documents.length);

    // Pair scores with documents, then sort descending by score
    const paired = input.documents.map((doc, index) => ({
      content: doc,
      originalIndex: index,
      relevanceScore: scores[index] ?? 0,
    }));

    return paired
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, count);
  }

  /**
   * Health check for reranker service
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Simple test with minimal data
      const testResult = await this.rerank("test query", ["test document"], 1);
      return testResult.length > 0;
    } catch (error) {
      logger.error(
        `Reranker health check failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  }
}
