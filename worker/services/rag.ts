import type { WaitUntilContext } from "../services/d1-utils.js";
import { createModelAlertReporter } from "../services/model-alerts.js";
import type {
	AppConfig,
	EmbeddingService as IEmbeddingService,
	RAGQuery,
	RAGResult,
	SearchResult,
} from "../services/types.js";
import { logger } from "../shared/logger.js";
import type { Env } from "../shared/types.js";
import { DatabaseService } from "./database.js";
import { EmbeddingService } from "./embedding.js";
import { createModelUsageRecorder } from "./model-usage.js";
import { RerankerService } from "./reranker.js";
import { type RankedSearchResult, SearchEngine } from "./search-engine.js";
import { TypeSafeRegion } from "./typesafe-region.js";

export class RAGService {
	readonly database: DatabaseService;
	readonly embedding: IEmbeddingService;
	private readonly reportFailure: ReturnType<typeof createModelAlertReporter>;
	private readonly usage: ReturnType<typeof createModelUsageRecorder>;

	constructor(
		config: AppConfig,
		private readonly env: Env,
		private readonly ctx: WaitUntilContext,
		channel: "mcp" | "cli",
	) {
		this.reportFailure = createModelAlertReporter(env, ctx, channel);
		this.usage = createModelUsageRecorder(env.DB, channel);
		this.database = new DatabaseService(config);
		this.embedding = new EmbeddingService(env, this.reportFailure, this.usage.record);
	}

	async query(request: RAGQuery): Promise<RAGResult> {
		const startTime = Date.now();
		const { query, result_count = 4, signal } = request;
		signal?.throwIfAborted();

		if (!query?.trim()) {
			throw new Error("Search query cannot be empty");
		}

		const trimmedQuery = query.trim();
		if (trimmedQuery.length > 10000) {
			throw new Error("Search query exceeds 10,000 characters");
		}

		const resultCount = Math.min(Math.max(result_count, 1), 10);
		let alert: { key: string; message: string } | undefined;
		const reranker = new RerankerService(
			this.env,
			(key, message) => {
				alert = { key, message };
			},
			this.usage.record,
			await TypeSafeRegion.forSearch(request.trace),
		);
		const searchResult = await new SearchEngine(this.database, this.embedding, reranker)
			.search(trimmedQuery, { resultCount, signal })
			.finally(() => this.ctx.waitUntil(this.usage.flush()));
		const formattedResults = this.formatResults(searchResult.results);
		const totalTime = Date.now() - startTime;
		if (alert) {
			const outcome = searchResult.degradations.length ? "degraded" : "success";
			this.reportFailure(
				alert.key,
				`${alert.message}\nSearch: ${outcome}, results=${formattedResults.length}`,
				request.trace,
			);
		}

		logger.info(
			`RAG query completed (${(totalTime / 1000).toFixed(1)}s) - results: ${formattedResults.length}, query: ${query.substring(0, 50)}`,
		);

		return {
			success: true,
			degradations: searchResult.degradations,
			query: trimmedQuery,
			results: formattedResults,
			additionalUrls: searchResult.additionalUrls,
			count: formattedResults.length,
			processing_time_ms: totalTime,
		};
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
}
