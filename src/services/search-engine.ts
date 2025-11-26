/**
 * Hybrid Search Engine for Apple Developer Documentation
 *
 * Advanced implementation combining Semantic Search for RAG with precise
 * Keyword Search and Hybrid Search, optimized for developer documentation retrieval.
 *
 * Pipeline: Query → [Vector (4N) + Technical Term (4N)] → Merge → Title Merge → AI Rerank → Results
 *
 * Features:
 * - 4N+4N hybrid candidate strategy
 * - Semantic vector search with pgvector HNSW
 * - Technical term search with PostgreSQL 'simple' configuration
 * - Title-based content merging
 * - AI reranking with Qwen3-Reranker-8B
 */

import type {
  AdditionalUrl,
  SearchOptions,
  SearchResult,
} from "../types/index.js";
import { logger } from "../utils/logger.js";
import type { DatabaseService } from "./database.js";
import type { EmbeddingService } from "./embedding.js";
import type { RerankerService } from "./reranker.js";

export interface ParsedChunk {
  content: string;
  title: string | null;
}

export interface ProcessedResult {
  id: string;
  url: string;
  title: string | null;
  content: string;
  contentLength: number;
  chunk_index: number;
  total_chunks: number;
  mergedChunkIndices?: number[];
}

export interface RankedSearchResult {
  id: string;
  url: string;
  title: string | null;
  content: string;
  chunk_index: number;
  total_chunks: number;
  mergedChunkIndices?: number[];
  original_index: number;
}

export interface SearchEngineResult {
  results: RankedSearchResult[];
  additionalUrls: AdditionalUrl[];
}

export class SearchEngine {
  constructor(
    private database: DatabaseService,
    private embedding: EmbeddingService,
    private reranker: RerankerService
  ) {}

  /**
   * Execute hybrid search optimized for Apple Developer Documentation
   */
  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchEngineResult> {
    const { resultCount = 4 } = options;
    return this.hybridSearchWithReranker(query, resultCount);
  }

  /**
   * Hybrid search with 4N+4N candidate strategy
   *
   * 1. Parallel: Vector search (4N) + Technical term search (4N)
   * 2. Merge and deduplicate by ID
   * 3. Title-based content merging
   * 4. AI reranking for optimal results
   */
  private async hybridSearchWithReranker(
    query: string,
    resultCount: number
  ): Promise<SearchEngineResult> {
    // Step 1: Parallel candidate retrieval (4N each, no minimum limit)
    const candidateCount = resultCount * 4;

    const [semanticResults, keywordResults] = await Promise.all([
      this.getSemanticCandidates(query, candidateCount),
      this.getKeywordCandidates(query, candidateCount),
    ]);

    // Step 2: Merge and deduplicate candidates
    const mergedCandidates = this.mergeCandidates(
      semanticResults,
      keywordResults
    );

    // Step 3: Process results (title-based merging)
    const processedResults = this.processResults(mergedCandidates);

    // Step 4: AI reranking with fallback mechanism
    let finalResults: RankedSearchResult[];

    try {
      const rankedDocuments = await this.reranker.rerank(
        query,
        processedResults.map((r) => r.content),
        Math.min(resultCount, processedResults.length)
      );

      // Step 5: Map back to final results
      finalResults = rankedDocuments.map((doc) => {
        const processed = processedResults[doc.originalIndex];
        return {
          id: processed.id,
          url: processed.url,
          title: processed.title,
          content: processed.content,
          chunk_index: processed.chunk_index,
          total_chunks: processed.total_chunks,
          mergedChunkIndices: processed.mergedChunkIndices,
          original_index: doc.originalIndex,
        };
      });
    } catch (error) {
      logger.error(
        `Reranking failed, falling back to original order (query_length: ${query.length}, candidates: ${processedResults.length}): ${error instanceof Error ? error.message : String(error)}`
      );

      // Fallback: use original order, truncate to requested count
      finalResults = processedResults
        .slice(0, resultCount)
        .map((processed, index) => ({
          id: processed.id,
          url: processed.url,
          title: processed.title,
          content: processed.content,
          chunk_index: processed.chunk_index,
          total_chunks: processed.total_chunks,
          mergedChunkIndices: processed.mergedChunkIndices,
          original_index: index,
        }));

      logger.warn(
        `Reranking failed, using original order with ${finalResults.length} results`
      );
    }

    // Collect additional URLs
    const additionalUrls = this.collectAdditionalUrls(
      processedResults,
      finalResults
    );

    return { results: finalResults, additionalUrls };
  }

  /**
   * Retrieve semantic search candidates with error handling
   */
  private async getSemanticCandidates(
    query: string,
    resultCount: number
  ): Promise<SearchResult[]> {
    const startTime = Date.now();

    try {
      const queryEmbedding = await this.embedding.createEmbedding(query);
      const results = await this.database.semanticSearch(queryEmbedding, {
        resultCount,
      });

      logger.info(
        `Semantic search completed (${((Date.now() - startTime) / 1000).toFixed(1)}s): ${results.length} results`
      );

      return results;
    } catch (error) {
      logger.error(
        `Semantic search failed, falling back to keyword-only: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }

  /**
   * Retrieve keyword search candidates with error handling
   */
  private async getKeywordCandidates(
    query: string,
    resultCount: number
  ): Promise<SearchResult[]> {
    const startTime = Date.now();

    try {
      const results = await this.database.keywordSearch(query, {
        resultCount,
      });

      logger.info(
        `Keyword search completed (${((Date.now() - startTime) / 1000).toFixed(1)}s): ${results.length} results`
      );

      return results;
    } catch (error) {
      logger.error(
        `Keyword search failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }

  /**
   * Merge and deduplicate candidates from semantic and keyword search
   */
  private mergeCandidates(
    semanticResults: SearchResult[],
    keywordResults: SearchResult[]
  ): SearchResult[] {
    const seen = new Set<string>();

    // Prioritize semantic results, then add unique keyword results
    return [
      ...semanticResults.filter((result) => {
        if (seen.has(result.id)) return false;
        seen.add(result.id);
        return true;
      }),
      ...keywordResults.filter((result) => {
        if (seen.has(result.id)) return false;
        seen.add(result.id);
        return true;
      }),
    ];
  }

  /**
   * Collect additional URLs from processed results
   */
  private collectAdditionalUrls(
    processedResults: ProcessedResult[],
    finalResults: RankedSearchResult[]
  ): AdditionalUrl[] {
    const finalUrls = new Set(finalResults.map((r) => r.url));

    return processedResults
      .filter((r) => !finalUrls.has(r.url))
      .reduce((urls, r) => {
        if (!urls.some((u) => u.url === r.url)) {
          urls.push({
            url: r.url,
            title: r.title,
            characterCount: r.contentLength,
          });
        }
        return urls;
      }, [] as AdditionalUrl[])
      .slice(0, 10);
  }

  /**
   * Process RAG candidates through title-based merging
   */
  private processResults(candidates: SearchResult[]): ProcessedResult[] {
    // Step 1: Merge by title
    return this.mergeByTitle(candidates);
  }

  private parseChunk(content: string, title: string | null): ParsedChunk {
    // Since data migration is complete, content is now plain text
    // and title comes from the dedicated title field
    return {
      title: title || "",
      content: content,
    };
  }

  private mergeByTitle(results: SearchResult[]): ProcessedResult[] {
    const titleGroups = new Map<string, SearchResult[]>();

    // Group by title
    for (const result of results) {
      const { title } = this.parseChunk(result.content, result.title);
      const titleKey = title || "untitled";
      if (!titleGroups.has(titleKey)) {
        titleGroups.set(titleKey, []);
      }
      titleGroups.get(titleKey)!.push(result);
    }

    return Array.from(titleGroups.entries()).map(([title, group]) => {
      const primary = group[0];

      // Sort and merge chunks by original index to maintain proper content order
      const chunkIndices = group
        .map((r) => r.chunk_index)
        .sort((a, b) => a - b);
      const mergedContent = group
        .sort((a, b) => a.chunk_index - b.chunk_index)
        .map((r) => this.parseChunk(r.content, r.title).content)
        .join("\n\n---\n\n");

      // Detect complete document merging
      const isCompleteDocument =
        chunkIndices.length === primary.total_chunks &&
        chunkIndices.every((idx, i) => idx === i);

      // Determine final chunk representation
      const [chunk_index, total_chunks] =
        chunkIndices.length === 1
          ? [chunkIndices[0], primary.total_chunks]
          : isCompleteDocument
            ? [0, 1]
            : [Math.min(...chunkIndices), primary.total_chunks];

      return {
        id: primary.id,
        url: primary.url,
        title,
        content: mergedContent,
        mergedChunkIndices: chunkIndices.length > 1 ? chunkIndices : undefined,
        contentLength: mergedContent.length,
        chunk_index,
        total_chunks,
      };
    });
  }
}
