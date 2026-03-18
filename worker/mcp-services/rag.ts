import type { AppConfig, RAGQuery, RAGResult, SearchResult } from "../mcp-types/index.js";
import type { Env } from "../shared/types.js";
import { logger } from "../mcp-utils/logger.js";
import { DatabaseService } from "./database.js";
import { EmbeddingService } from "./embedding.js";
import { RerankerService } from "./reranker.js";
import { type RankedSearchResult, SearchEngine } from "./search-engine.js";

export class RAGService {
	readonly database: DatabaseService;
	readonly embedding: EmbeddingService;
	private readonly searchEngine: SearchEngine;

	constructor(config: AppConfig, env: Env) {
		this.database = new DatabaseService(config);
		this.embedding = new EmbeddingService(env.DEEPINFRA_API_KEY);
		const reranker = new RerankerService(env.DEEPINFRA_API_KEY);
		this.searchEngine = new SearchEngine(this.database, this.embedding, reranker);
	}

	async query(request: RAGQuery): Promise<RAGResult> {
		const startTime = Date.now();
		const { query, result_count = 4 } = request;

		if (!query?.trim()) {
			return this.emptyResult(query, startTime);
		}

		const trimmedQuery = query.trim();
		if (trimmedQuery.length > 10000) {
			return this.emptyResult(query, startTime);
		}

		try {
			const resultCount = Math.min(Math.max(result_count, 1), 20);
			const searchResult = await this.searchEngine.search(trimmedQuery, { resultCount });
			const formattedResults = this.formatResults(searchResult.results);
			const totalTime = Date.now() - startTime;

			logger.info(
				`RAG query completed (${(totalTime / 1000).toFixed(1)}s) - results: ${formattedResults.length}, query: ${query.substring(0, 50)}`,
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
				`RAG query failed for "${trimmedQuery.substring(0, 50)}": ${error instanceof Error ? error.message : "Unknown error"}`,
			);
			return this.emptyResult(trimmedQuery, startTime);
		}
	}

	private formatResults(results: readonly RankedSearchResult[]): SearchResult[] {
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

	private emptyResult(query: string, startTime: number): RAGResult {
		return {
			success: false,
			query,
			results: [],
			additionalUrls: [],
			count: 0,
			processing_time_ms: Date.now() - startTime,
		};
	}

	async close(): Promise<void> {
		await this.database?.close();
	}
}
