/**
 * DeepInfra client utilities (config + base service)
 * Minimal single-key client with retry support.
 */

import { logger } from "../utils/logger.js";

export const DEEPINFRA_CONFIG = {
  BASE_URL: "https://api.deepinfra.com",
  TIMEOUT_MS: 5_000,
  USER_AGENT: "Apple-RAG-MCP/2.0.0",
  EMBEDDING_MODEL: "Qwen/Qwen3-Embedding-4B",
  RERANKER_MODEL_PRIMARY: "Qwen/Qwen3-Reranker-8B",
  RERANKER_MODEL_FALLBACK: "Qwen/Qwen3-Reranker-4B",
} as const;

export abstract class DeepInfraService<TRequest, TResponse, TResult> {
  protected abstract readonly endpoint: string;
  private readonly apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) throw new Error("DEEPINFRA_API_KEY is required");
    this.apiKey = apiKey;
  }

  protected async call(
    input: TRequest,
    operationName: string
  ): Promise<TResult> {
    const startTime = Date.now();
    const payload = this.buildPayload(input);
    let lastError!: Error;

    for (let i = 0; i < 3; i++) {
      try {
        const json = await this.singleRequest(this.endpoint, payload);
        logger.info(
          `${operationName} completed (${((Date.now() - startTime) / 1000).toFixed(1)}s)`
        );
        return this.processResponse(json, input);
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
      }
    }

    logger.error(
      `${operationName} failed after 3 attempts (${((Date.now() - startTime) / 1000).toFixed(1)}s): ${lastError.message}`
    );
    throw lastError;
  }

  protected async singleRequest(
    endpoint: string,
    payload: unknown
  ): Promise<TResponse> {
    const res = await fetch(`${DEEPINFRA_CONFIG.BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": DEEPINFRA_CONFIG.USER_AGENT,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(DEEPINFRA_CONFIG.TIMEOUT_MS),
    });

    if (!res.ok) {
      throw new Error(
        `API error ${res.status}: ${await res.text().catch(() => "")}`
      );
    }

    return (await res.json()) as TResponse;
  }

  protected abstract buildPayload(input: TRequest): unknown;
  protected abstract processResponse(
    response: TResponse,
    input: TRequest
  ): TResult;
}
