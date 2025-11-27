/**
 * DeepInfra Reranker Service - MCP Optimized
 * Dual-model fallback: 8B → 4B, 2 attempts each
 */

import { logger } from "../utils/logger.js";
import { DEEPINFRA_CONFIG, DeepInfraService } from "./deepinfra-base.js";

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

type ModelConfig = { endpoint: string; name: string };

export class RerankerService extends DeepInfraService<
  RerankerInput,
  RerankerResponse,
  RankedDocument[]
> {
  protected readonly endpoint = `/v1/inference/${DEEPINFRA_CONFIG.RERANKER_MODEL_PRIMARY}`;

  private static readonly MODELS: readonly ModelConfig[] = [
    {
      endpoint: `/v1/inference/${DEEPINFRA_CONFIG.RERANKER_MODEL_PRIMARY}`,
      name: "8B",
    },
    {
      endpoint: `/v1/inference/${DEEPINFRA_CONFIG.RERANKER_MODEL_FALLBACK}`,
      name: "4B",
    },
  ];

  private static readonly MAX_ATTEMPTS = 2;

  async rerank(
    query: string,
    documents: string[],
    topN: number
  ): Promise<RankedDocument[]> {
    if (!query?.trim()) throw new Error("Query cannot be empty for reranking");
    if (!documents?.length)
      throw new Error("Documents cannot be empty for reranking");

    const validTopN = Math.min(topN, documents.length);
    if (validTopN <= 0) throw new Error("top_n must be greater than 0");

    return this.call(
      { query: query.trim(), documents, topN: validTopN },
      "Document reranking"
    );
  }

  /**
   * Dual-model fallback: 8B (2 attempts) → 4B (2 attempts) → fail
   */
  protected override async call(
    input: RerankerInput,
    operationName: string
  ): Promise<RankedDocument[]> {
    const startTime = Date.now();
    const payload = this.buildPayload(input);
    const errors: string[] = [];

    for (const model of RerankerService.MODELS) {
      const result = await this.tryModel(model, payload, input);
      if (result.success) {
        logger.info(
          `${operationName} completed with ${model.name} (${this.elapsed(startTime)})`
        );
        return result.data!;
      }
      errors.push(`${model.name}: ${result.error!}`);
      logger.warn(`${model.name} model failed, ${model === RerankerService.MODELS[0] ? "switching to 4B" : "no more fallbacks"}`);
    }

    logger.error(
      `${operationName} failed after all attempts (${this.elapsed(startTime)}): ${errors.join(" | ")}`
    );
    throw new Error(`Reranking failed: ${errors.join(" | ")}`);
  }

  private async tryModel(
    model: ModelConfig,
    payload: RerankerPayload,
    input: RerankerInput
  ): Promise<{ success: boolean; data?: RankedDocument[]; error?: string }> {
    let lastError = "";

    for (let attempt = 1; attempt <= RerankerService.MAX_ATTEMPTS; attempt++) {
      try {
        const response = await this.singleRequest(model.endpoint, payload);
        return { success: true, data: this.processResponse(response, input) };
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        logger.warn(
          `${model.name} attempt ${attempt}/${RerankerService.MAX_ATTEMPTS} failed: ${lastError}`
        );
      }
    }

    return { success: false, error: lastError };
  }

  private elapsed(startTime: number): string {
    return `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
  }

  protected buildPayload(input: RerankerInput): RerankerPayload {
    return {
      queries: [input.query],
      documents: input.documents,
      top_n: input.topN,
    };
  }

  protected processResponse(
    response: RerankerResponse,
    input: RerankerInput
  ): RankedDocument[] {
    if (!response.scores?.length) {
      throw new Error("No reranking results received from DeepInfra API");
    }

    const count = Math.min(
      input.topN,
      response.scores.length,
      input.documents.length
    );

    return input.documents
      .map((content, index) => ({
        content,
        originalIndex: index,
        relevanceScore: response.scores[index] ?? 0,
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, count);
  }

  async healthCheck(): Promise<boolean> {
    try {
      return (await this.rerank("test query", ["test document"], 1)).length > 0;
    } catch (error) {
      logger.error(
        `Reranker health check failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  }
}
