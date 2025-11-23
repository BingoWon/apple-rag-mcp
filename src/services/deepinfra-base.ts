/**
 * DeepInfra client utilities (config + base service)
 * Minimal single-key client with no fallback.
 */

import { logger } from "../utils/logger.js";

export const DEEPINFRA_CONFIG = {
  BASE_URL: "https://api.deepinfra.com",
  TIMEOUT_MS: 7 * 1000,
  USER_AGENT: "Apple-RAG-MCP/2.0.0",
  EMBEDDING_MODEL: "Qwen/Qwen3-Embedding-4B",
  RERANKER_MODEL: "Qwen/Qwen3-Reranker-8B",
} as const;

export abstract class DeepInfraService<TRequest, TResponse, TResult> {
  protected abstract readonly endpoint: string;
  private readonly apiKey: string;

  constructor(_db: D1Database, apiKey: string) {
    if (!apiKey) {
      throw new Error("DEEPINFRA_API_KEY is required");
    }
    this.apiKey = apiKey;
  }

  /**
   * Single-attempt API call (no fallback to other providers)
   */
  protected async call(
    input: TRequest,
    operationName: string
  ): Promise<TResult> {
    const startTime = Date.now();

    const payload = this.buildPayload(input);
    const headers = this.buildHeaders();

    const response = await fetch(
      `${DEEPINFRA_CONFIG.BASE_URL}${this.endpoint}`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(DEEPINFRA_CONFIG.TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      logger.error(
        `${operationName} failed ${response.status}: ${errorText} (${(
          (Date.now() - startTime) / 1000
        ).toFixed(1)}s)`
      );
      throw new Error(
        `DeepInfra API error ${response.status}: ${errorText || "Unknown error"}`
      );
    }

    const json = (await response.json()) as TResponse;

    const duration = Date.now() - startTime;
    logger.info(
      `${operationName} completed (${(duration / 1000).toFixed(1)}s)`
    );

    return this.processResponse(json, input);
  }

  private buildHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": DEEPINFRA_CONFIG.USER_AGENT,
    };
  }

  // Abstract methods to be implemented by subclasses
  protected abstract buildPayload(input: TRequest): unknown;
  protected abstract processResponse(
    response: TResponse,
    input: TRequest
  ): TResult;
}
