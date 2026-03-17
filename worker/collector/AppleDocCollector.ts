import { AppleAPIClient } from "./AppleAPIClient.js";
import { Chunker } from "./Chunker.js";
import { ContentProcessor } from "./ContentProcessor.js";
import { createEmbeddings } from "./EmbeddingProvider.js";
import type { PostgreSQLManager } from "./PostgreSQLManager.js";
import type { BatchConfig, BatchResult, DatabaseRecord, DocumentContent } from "./types/index.js";
import { BatchErrorHandler } from "./utils/batch-error-handler.js";
import { logger } from "./utils/logger.js";
import { notifyStats } from "./utils/telegram-notifier.js";

interface ProcessBatchResult {
	successRecords: DatabaseRecord[];
	failureRecords: DatabaseRecord[];
	deleteIds: string[];
	extractedUrls: Set<string>;
	totalChunks: number;
}

interface ProcessingPlanItem {
	record: DatabaseRecord;
	collectResult: BatchResult<any>;
	hasChanged: boolean;
	newRawJson?: string | null;
	processResult?: BatchResult<DocumentContent> | undefined;
	error?: string;
	isPermanentError?: boolean;
}

interface ComparisonResult {
	hasChanged: boolean;
	difference?: string;
	oldContent?: string | null;
	newContent?: string;
}

class AppleDocCollector {
	private readonly apiClient: AppleAPIClient;
	private readonly contentProcessor: ContentProcessor;
	private readonly chunker: Chunker;
	private readonly dbManager: PostgreSQLManager;
	private readonly apiKey: string;
	private readonly config: BatchConfig;
	private batchCounter: number = 0;

	constructor(dbManager: PostgreSQLManager, apiKey: string, config: BatchConfig) {
		this.dbManager = dbManager;
		this.apiKey = apiKey;
		this.config = config;
		this.apiClient = new AppleAPIClient();
		this.contentProcessor = new ContentProcessor();
		this.chunker = new Chunker(config);
	}

	/**
	 * Discover and sync all video URLs to database
	 * Returns count of newly inserted video URLs
	 */
	async discoverVideos(): Promise<number> {
		const videoUrls = await this.apiClient.discoverVideoUrls();
		const inserted = await this.dbManager.batchInsertUrls(videoUrls);

		if (inserted > 0) {
			logger.info(`🎬 Video discovery: ${inserted} new videos added`);
		}

		return inserted;
	}

	async execute(): Promise<{
		batchNumber: number;
		totalChunks: number;
	}> {
		const records = await this.dbManager.getBatchRecords(this.config.batchSize);

		this.batchCounter++;
		const startTime = Date.now();

		logger.info(`\n🚀 Batch #${this.batchCounter}: Processing ${records.length} URLs`);

		const result = await this.processBatch(records);

		if (result.extractedUrls.size > 0) {
			await this.dbManager.batchInsertUrls([...result.extractedUrls]);
		}

		const duration = Date.now() - startTime;

		logger.info(
			`✅ Batch #${this.batchCounter} completed in ${duration}ms: ${result.totalChunks} chunks generated`,
		);

		return {
			batchNumber: this.batchCounter,
			totalChunks: result.totalChunks,
		};
	}

	private async processBatch(records: DatabaseRecord[]): Promise<ProcessBatchResult> {
		// Split records by type
		const videoRecords = records.filter((r) => AppleAPIClient.isVideoUrl(r.url));
		const docRecords = records.filter((r) => !AppleAPIClient.isVideoUrl(r.url));

		// Fetch content in parallel
		const [videoResults, docApiResults] = await Promise.all([
			videoRecords.length > 0 ? this.apiClient.fetchVideos(videoRecords.map((r) => r.url)) : [],
			docRecords.length > 0 ? this.apiClient.fetchDocuments(docRecords.map((r) => r.url)) : [],
		]);

		// Process documents through contentProcessor
		const validDocResults = docApiResults.filter((r) => r.data);
		const docProcessResults =
			validDocResults.length > 0
				? await this.contentProcessor.processDocuments(validDocResults)
				: [];

		// Build result maps (preserving original order)
		const collectResultsMap = new Map<string, BatchResult<any>>();
		const processResultsMap = new Map<string, BatchResult<DocumentContent>>();

		// Map document results (use filter to align indices)
		const validDocUrls = docApiResults.filter((r) => r.data).map((r) => r.url);
		docApiResults.forEach((result) => {
			collectResultsMap.set(result.url, result);
		});
		validDocUrls.forEach((url, i) => {
			processResultsMap.set(url, docProcessResults[i]!);
		});

		// Map video results (convert VideoContent to DocumentContent format)
		videoResults.forEach((result) => {
			collectResultsMap.set(result.url, result);
			if (result.data) {
				processResultsMap.set(result.url, {
					url: result.url,
					data: {
						title: result.data.title,
						content: result.data.content,
						extractedUrls: [],
					},
				});
			}
		});

		// Build collect results in original record order
		const collectResults = records.map(
			(r) =>
				collectResultsMap.get(r.url) || {
					url: r.url,
					data: null,
					error: "Missing result",
				},
		);

		const processingPlan = this.createProcessingPlan(records, collectResults, processResultsMap);
		return await this.executeProcessingPlan(processingPlan);
	}

	private createProcessingPlan(
		records: DatabaseRecord[],
		collectResults: BatchResult<any>[],
		processResultsMap: Map<string, BatchResult<DocumentContent>>,
	): ProcessingPlanItem[] {
		if (this.config.forceUpdateAll) {
			logger.info(`🔄 Force Update: Processing all ${records.length} URLs`);
		}

		const planItems = records.map((record, index) => {
			const collectResult = collectResults[index];

			if (!collectResult || !collectResult.data) {
				return this.createErrorPlanItem(
					record,
					collectResult || {
						url: record.url,
						data: null,
						error: "Missing collect result",
					},
				);
			}

			const processResult = processResultsMap.get(record.url);
			return this.createSuccessPlanItem(record, collectResult, processResult);
		});

		return planItems;
	}

	private createErrorPlanItem(
		record: DatabaseRecord,
		collectResult: BatchResult<any>,
	): ProcessingPlanItem {
		const isPermanent = BatchErrorHandler.isPermanentError(collectResult.error || "");
		return {
			record,
			collectResult,
			hasChanged: false,
			error: collectResult.error || "Unknown error",
			isPermanentError: isPermanent,
		};
	}

	private createSuccessPlanItem(
		record: DatabaseRecord,
		collectResult: BatchResult<any>,
		processResult?: BatchResult<DocumentContent>,
	): ProcessingPlanItem {
		// Videos don't have raw JSON API response, only documents do
		const isVideo = AppleAPIClient.isVideoUrl(record.url);
		const newRawJson = isVideo ? null : JSON.stringify(collectResult.data);
		const comparison = this.compareContent(record, processResult);

		this.logContentChanges(record.url, comparison);

		return {
			record,
			collectResult,
			hasChanged: comparison.hasChanged,
			newRawJson,
			processResult,
		};
	}

	private compareContent(
		oldRecord: DatabaseRecord,
		processResult?: BatchResult<DocumentContent>,
	): ComparisonResult {
		if (this.config.forceUpdateAll) {
			return { hasChanged: true };
		}

		if (!processResult?.data) {
			return { hasChanged: false };
		}

		const newTitle = processResult.data.title;
		const newContent = processResult.data.content;

		const titleChanged = oldRecord.title !== newTitle;
		const contentChanged = oldRecord.content !== newContent;
		const hasChanged = titleChanged || contentChanged;

		if (hasChanged) {
			const changes = [];
			if (titleChanged) changes.push(`Title: "${oldRecord.title}" → "${newTitle}"`);
			if (contentChanged)
				changes.push(`Content: ${oldRecord.content.length} → ${newContent.length} chars`);

			return {
				hasChanged,
				difference: changes.join(", "),
				oldContent: `Title: ${oldRecord.title}\nContent: ${oldRecord.content.substring(0, 200)}...`,
				newContent: `Title: ${newTitle}\nContent: ${newContent.substring(0, 200)}...`,
			};
		}

		return { hasChanged: false };
	}

	private logContentChanges(url: string, comparison: ComparisonResult): void {
		if (comparison.hasChanged && !this.config.forceUpdateAll && comparison.difference) {
			const consolidatedMessage = [
				`📝 Content change detected for ${url}:`,
				`${comparison.difference}`,
				``,
				`🔍 DEBUG - Complete content comparison:`,
				`📄 OLD CONTENT:`,
				`${comparison.oldContent || "null"}`,
				``,
				`📄 NEW CONTENT:`,
				`${comparison.newContent || "null"}`,
				`🔚 END DEBUG for ${url}`,
			].join("\n");

			logger.info(consolidatedMessage);
		}
	}

	private async executeProcessingPlan(
		processingPlan: ProcessingPlanItem[],
	): Promise<ProcessBatchResult> {
		const changedRecords = processingPlan.filter((r) => r.hasChanged && !r.error);
		const unchangedRecords = processingPlan.filter((r) => !r.hasChanged && !r.error);
		const errorRecords = processingPlan.filter((r) => r.error);

		const processResults = changedRecords.map((r) => r.processResult).filter(Boolean);

		const { allChunks, embeddings } = await this.generateChunksAndEmbeddings(processResults);

		if (changedRecords.length > 0) {
			logger.info(`📝 Content changed: ${changedRecords.length} URLs (full processing)`);

			if (!this.config.forceUpdateAll) {
				const realChangedRecords = changedRecords.filter((r) => r.record.content !== "");

				if (realChangedRecords.length > 0) {
					const MAX_URLS_DISPLAY = 10;
					const urlsToShow = realChangedRecords.slice(0, MAX_URLS_DISPLAY);
					const remaining = realChangedRecords.length - MAX_URLS_DISPLAY;

					const urlList = urlsToShow.map((r) => r.record.url).join("\n");
					const remainingText = remaining > 0 ? `\n...and ${remaining} more` : "";

					const message =
						`📝 Content Updated: ${realChangedRecords.length} URLs\n\n` +
						`${urlList}${remainingText}`;

					await notifyStats(message);
				}
			}

			if (allChunks.length > 0) {
				const chunksWithEmbeddings = allChunks.map((item, index) => ({
					url: item.url,
					title: item.chunk.title,
					content: item.chunk.content,
					embedding: embeddings[index] || [],
					chunk_index: item.chunk.chunk_index,
					total_chunks: item.chunk.total_chunks,
				}));
				await this.dbManager.insertChunks(chunksWithEmbeddings);
			}

			await this.dbManager.batchUpdateFullRecords(
				changedRecords.map((r) => {
					return {
						...r.record,
						updated_at: new Date(),
						raw_json: r.newRawJson || JSON.stringify(r.collectResult.data),
						title: r.processResult?.data?.title || null,
						content: r.processResult?.data?.content || "",
					};
				}),
			);
		}

		if (unchangedRecords.length > 0) {
			logger.info(
				`🔄 Content unchanged: ${unchangedRecords.length} URLs (no database update needed)`,
			);
		}

		const permanentErrorRecords = errorRecords.filter((r) => r.isPermanentError);
		const temporaryErrorRecords = errorRecords.filter((r) => !r.isPermanentError);

		if (permanentErrorRecords.length > 0) {
			const permanentUrls = permanentErrorRecords
				.map((r) => `${r.record.url} (${r.error})`)
				.join("\n");
			logger.info(
				`🗑️ Permanent errors: ${permanentErrorRecords.length} URLs (deleting records)\nDeleted URLs:\n${permanentUrls}`,
			);

			await this.dbManager.deleteRecords(permanentErrorRecords.map((r) => r.record.id));
		}

		if (temporaryErrorRecords.length > 0) {
			const temporaryUrls = temporaryErrorRecords
				.map((r) => `${r.record.url} (${r.error})`)
				.join("\n");
			await logger.warn(
				`Temporary errors: ${temporaryErrorRecords.length} URLs in batch ${this.batchCounter}\n${temporaryUrls}`,
			);
		}

		return this.buildProcessingResult(processingPlan, processResults, allChunks);
	}

	private async generateChunksAndEmbeddings(processResults: any[]): Promise<{
		allChunks: Array<{
			url: string;
			chunk: {
				title: string | null;
				content: string;
				chunk_index: number;
				total_chunks: number;
			};
		}>;
		embeddings: number[][];
	}> {
		const chunkResults =
			processResults.length > 0
				? this.chunker.chunkTexts(
						processResults
							.filter((r) => r.data)
							.map((r) => ({
								url: r.url,
								title: r.data!.title,
								content: r.data!.content,
							})),
					)
				: [];

		const allChunks = chunkResults.flatMap((r) =>
			r.data ? r.data.map((chunk) => ({ url: r.url, chunk })) : [],
		);

		const embeddingTexts = allChunks.map((c) => {
			return c.chunk.title ? `${c.chunk.title}\n\n${c.chunk.content}` : c.chunk.content;
		});

		const embeddings =
			embeddingTexts.length > 0 ? await createEmbeddings(embeddingTexts, this.apiKey) : [];

		return { allChunks, embeddings };
	}

	private buildProcessingResult(
		processingPlan: ProcessingPlanItem[],
		processResults: any[],
		allChunks: Array<{
			url: string;
			chunk: {
				title: string | null;
				content: string;
				chunk_index: number;
				total_chunks: number;
			};
		}>,
	): ProcessBatchResult {
		const successRecords: DatabaseRecord[] = [];
		const failureRecords: DatabaseRecord[] = [];
		const extractedUrls = new Set<string>();

		let processIndex = 0;
		for (const planItem of processingPlan) {
			const { record, collectResult, hasChanged, error } = planItem;

			if (error) {
				failureRecords.push(record);
				continue;
			}

			successRecords.push(record);

			if (hasChanged && collectResult?.data && processIndex < processResults.length) {
				const processResult = processResults[processIndex++];
				if (processResult?.data?.extractedUrls) {
					processResult.data.extractedUrls.forEach((url: string) => extractedUrls.add(url));
				}
			}
		}

		return {
			successRecords,
			failureRecords,
			deleteIds: [],
			extractedUrls,
			totalChunks: allChunks.length,
		};
	}
}

export { AppleDocCollector };
