import type { WaitUntilContext } from "../services/d1-utils.js";
import { createModelAlertReporter } from "../services/model-alerts.js";
import type {
	AppConfig,
	RAGQuery,
	RAGResult,
	SearchResult,
	SearchTrace,
} from "../services/types.js";
import { logger } from "../shared/logger.js";
import type { Env } from "../shared/types.js";
import { DatabaseService } from "./database.js";
import { EmbeddingService } from "./embedding.js";
import { createModelUsageRecorder, type EmbeddingAttempt } from "./model-usage.js";
import { RerankerService } from "./reranker.js";
import { type RankedSearchResult, SearchEngine } from "./search-engine.js";

export class RAGService {
	readonly database: DatabaseService;
	private readonly reportFailure: ReturnType<typeof createModelAlertReporter>;

	constructor(
		config: AppConfig,
		private readonly env: Env,
		private readonly ctx: WaitUntilContext,
		private readonly channel: "mcp" | "cli",
	) {
		this.reportFailure = createModelAlertReporter(env, ctx, channel);
		this.database = new DatabaseService(config);
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
		const trace = request.trace ?? { requestId: crypto.randomUUID() };
		const usage = createModelUsageRecorder(this.env.DB, this.channel, trace.requestId);
		const attempts: EmbeddingAttempt[] = [];
		const embedding = new EmbeddingService(
			this.env,
			(event, attempt) => {
				attempts.push(attempt);
				usage.record(event, attempt);
			},
			trace.requestId,
		);
		let ranking: { key: string; message: string } | undefined;
		const reranker = new RerankerService(
			this.env,
			(key, message) => {
				ranking = { key, message };
			},
			usage.record,
			trace.country,
		);
		let result: RAGResult | undefined;
		try {
			const search = await new SearchEngine(this.database, embedding, reranker).search(
				trimmedQuery,
				{ resultCount, signal },
			);
			signal?.throwIfAborted();
			const results = this.formatResults(search.results);
			const elapsed = Date.now() - startTime;
			logger.info(
				`RAG query completed (${(elapsed / 1000).toFixed(1)}s) - results: ${results.length}, query: ${query.substring(0, 50)}`,
			);
			result = {
				success: true,
				degradations: search.degradations,
				query: trimmedQuery,
				results,
				additionalUrls: search.additionalUrls,
				count: results.length,
				processing_time_ms: elapsed,
			};
			return result;
		} finally {
			this.ctx.waitUntil(usage.flush());
			if (!signal?.aborted)
				this.reportOutcome(
					trace,
					attempts,
					ranking,
					result,
					Date.now() - (request.startedAt ?? startTime),
				);
		}
	}

	private reportOutcome(
		trace: SearchTrace,
		attempts: EmbeddingAttempt[],
		ranking: { key: string; message: string } | undefined,
		result: RAGResult | undefined,
		elapsedMs: number,
	) {
		const embeddingIssue =
			!attempts.length || attempts.some((attempt) => attempt.outcome !== "success");
		if (!embeddingIssue && !ranking) return;
		let status = "Search completed";
		if (!result) status = "Search failed";
		else if (result.degradations.includes("SEMANTIC_UNAVAILABLE")) status = "Keyword-only search";
		else if (result.degradations.includes("KEYWORD_UNAVAILABLE")) status = "Semantic-only search";
		else if (embeddingIssue) status = "Search completed after embedding recovery";
		const lines = [`${status}: results=${result?.count ?? 0}, elapsed_ms=${elapsedMs}`];
		if (embeddingIssue) {
			const steps = attempts.map(
				(a) =>
					`#${a.attempt} ${a.provider} ${a.http_status ? `HTTP ${a.http_status}` : a.outcome} (${a.elapsed_ms}ms)`,
			);
			lines.push(`Embedding: ${steps.join(" → ") || "no provider configured"}`);
		}
		if (ranking) lines.push(ranking.message);
		const key = embeddingIssue ? null : `${ranking?.key ?? "search"}:${status}`;
		this.reportFailure(key, lines.join("\n"), trace);
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
