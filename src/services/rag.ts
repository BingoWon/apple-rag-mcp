/**
 * Modern RAG Service - Cloudflare Worker Native
 * Optimized for edge computing with zero-dependency architecture
 */

import type {
  AppConfig,
  RAGQuery,
  RAGResult,
  SearchResult,
  WorkerEnv,
} from "../types/index.js";
import { logger } from "../utils/logger.js";
import { DatabaseService } from "./database.js";
import { EmbeddingService } from "./embedding.js";
import { RerankerService } from "./reranker.js";
import { type RankedSearchResult, SearchEngine } from "./search-engine.js";

export class RAGService {
  readonly database: DatabaseService;
  readonly embedding: EmbeddingService;
  private readonly reranker: RerankerService;
  private readonly searchEngine: SearchEngine;

  constructor(config: AppConfig, env: WorkerEnv) {
    this.database = new DatabaseService(config);
    this.embedding = new EmbeddingService(env.DEEPINFRA_API_KEY);
    this.reranker = new RerankerService(env.DEEPINFRA_API_KEY);
    this.searchEngine = new SearchEngine(
      this.database,
      this.embedding,
      this.reranker
    );
  }

  /**
   * Initialize - no-op since database initialization is removed
   */
  async initialize(): Promise<void> {
    // No initialization needed - database trusted ready
  }

  /**
   * Perform RAG query with intelligent processing and detailed timing
   */
  async query(request: RAGQuery): Promise<RAGResult> {
    const startTime = Date.now();
    const { query, result_count = 4 } = request;

    // No started log - only completion with timing

    // Input validation
    if (!query?.trim()) {
      return this.createErrorResponse(
        query,
        "Query cannot be empty. Please provide a search query to find relevant Apple Developer Documentation.",
        "Try searching for topics like 'SwiftUI navigation', 'iOS app development', or 'API documentation'.",
        startTime
      );
    }

    const trimmedQuery = query.trim();
    if (trimmedQuery.length > 10000) {
      return this.createErrorResponse(
        query,
        "Query is too long. Please limit your query to 10000 characters or less.",
        "Try to make your query more concise and specific.",
        startTime
      );
    }

    try {
      // Initialize services (if not already initialized)
      await this.initialize();

      // Execute search
      const resultCount = Math.min(Math.max(result_count, 1), 20);

      const searchResult = await this.searchEngine.search(trimmedQuery, {
        resultCount,
      });

      // Format results
      const formattedResults = this.formatResults(searchResult.results);
      const totalTime = Date.now() - startTime;

      // Log completion with timing
      logger.info(
        `RAG query completed (${(totalTime / 1000).toFixed(1)}s) - results: ${formattedResults.length}, query: ${query.substring(0, 50)}`
      );

      return {
        success: true,
        query: trimmedQuery,
        results: formattedResults,
        additionalUrls: searchResult.additionalUrls,
        count: formattedResults.length,
        processing_time_ms: totalTime,
      };
    } catch (error) {
      logger.error(
        `RAG query failed for query "${trimmedQuery.substring(0, 50)}": ${error instanceof Error ? error.message : "Unknown error"}`
      );
      return this.createErrorResponse(
        trimmedQuery,
        `Search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        "Please try again with a different query or check your connection.",
        startTime
      );
    }
  }

  /**
   * Format search results for MCP response
   */
  private formatResults(
    results: readonly RankedSearchResult[]
  ): SearchResult[] {
    return results.map((result) => ({
      id: result.id,
      url: result.url,
      title: result.title,
      content: result.content,
      contentLength: result.content.length,
      chunk_index: result.chunk_index,
      total_chunks: result.total_chunks,
      mergedChunkIndices: result.mergedChunkIndices,
    }));
  }

  /**
   * Create standardized error response
   */
  private createErrorResponse(
    query: string,
    _error: string,
    _suggestion: string,
    startTime: number
  ): RAGResult {
    return {
      success: false,
      query,
      results: [],
      additionalUrls: [],
      count: 0,
      processing_time_ms: Date.now() - startTime,
    };
  }

  /**
   * Clean up resources
   */
  async close(): Promise<void> {
    if (this.database) {
      await this.database.close();
    }
  }
}
