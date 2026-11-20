import type { ModelUsageRecorder } from "../services/model-usage.js";
import { AppleAPIClient } from "./AppleAPIClient.js";
import { chunkText, matchesChunkLayout } from "./Chunker.js";
import { ContentProcessor } from "./ContentProcessor.js";
import { createEmbeddings } from "./EmbeddingProvider.js";
import type { PostgreSQLManager } from "./PostgreSQLManager.js";
import type { BatchConfig, BatchResult, DatabaseRecord, DocumentContent } from "./types/index.js";
import { BatchErrorHandler } from "./utils/batch-error-handler.js";
import { logger } from "./utils/logger.js";
import { notifyStats } from "./utils/telegram-notifier.js";

class AppleDocCollector {
	private readonly apiClient = new AppleAPIClient();
	private readonly contentProcessor = new ContentProcessor();
	constructor(
		private readonly dbManager: PostgreSQLManager,
		private readonly apiKey: string,
		private readonly config: BatchConfig,
		private readonly recordUsage?: ModelUsageRecorder,
	) {}
	/**
	 * Discover and sync all video URLs to database
	 * Returns count of newly inserted video URLs
	 */
	async discoverVideos(): Promise<number> {
		let videoUrls: string[];
		try {
			videoUrls = await this.apiClient.discoverVideoUrls();
		} catch (error) {
			throw new Error(
				`Apple video index fetch failed: ${error instanceof Error ? error.message : String(error)}`,
				{ cause: error },
			);
		}

		let inserted: number;
		try {
			inserted = await this.dbManager.batchInsertUrls(videoUrls);
		} catch (error) {
			throw new Error(
				`PostgreSQL video URL sync failed: ${error instanceof Error ? error.message : String(error)}`,
				{ cause: error },
			);
		}

		if (inserted > 0) {
			logger.info(`🎬 Video discovery: ${inserted} new videos added`);
		}

		return inserted;
	}

	async execute(ids?: string[]) {
		const records = await this.dbManager
			.getBatchRecords(this.config.batchSize, ids)
			.catch((error) => {
				throw new Error(
					`PostgreSQL batch claim failed: ${error instanceof Error ? error.message : error}`,
					{ cause: error },
				);
			});
		if (ids && records.length !== ids.length) throw Error("Some recovery pages no longer exist");
		const [videos, docs] = await Promise.all([
			this.apiClient.fetchVideos(
				records.filter((r) => AppleAPIClient.isVideoUrl(r.url)).map((r) => r.url),
			),
			this.apiClient.fetchDocuments(
				records.filter((r) => !AppleAPIClient.isVideoUrl(r.url)).map((r) => r.url),
			),
		]);
		const parsed = await this.contentProcessor.processDocuments(docs.filter((r) => r.data));
		const raw = new Map(docs.filter((r) => r.data).map((r) => [r.url, JSON.stringify(r.data)]));
		const results = new Map<string, BatchResult<DocumentContent>>();
		for (const r of docs)
			if (!r.data)
				results.set(r.url, { url: r.url, data: null, error: r.error || "Missing response" });
		for (const r of parsed) results.set(r.url, r);
		for (const r of videos)
			results.set(r.url, { ...r, data: r.data ? { ...r.data, extractedUrls: [] } : null });
		const links = new Set<string>();
		const failures: { record: DatabaseRecord; error: string }[] = [];
		const pages = [];
		for (const record of records) {
			const result = results.get(record.url);
			if (!result?.data || (record.content?.trim() && !result.data.content.trim())) {
				failures.push({ record, error: result?.error || "No usable replacement content" });
				continue;
			}
			const { title, content, extractedUrls } = result.data;
			for (const link of extractedUrls) links.add(link);
			pages.push({
				record,
				title,
				content,
				raw_json: raw.get(record.url) ?? JSON.stringify({ title, content }),
				chunks: chunkText(content, title),
			});
		}
		if (links.size)
			await this.dbManager.batchInsertUrls([...links]).catch((error) => {
				throw new Error(
					`PostgreSQL discovered URL sync failed: ${error instanceof Error ? error.message : error}`,
					{ cause: error },
				);
			});
		const sameBody = pages.filter(
			(p) =>
				!this.config.forceUpdateAll && p.record.title === p.title && p.record.content === p.content,
		);
		const layouts = new Map<
			string,
			Awaited<ReturnType<PostgreSQLManager["getChunkLayout"]>>[number][]
		>();
		if (sameBody.length)
			for (const row of await this.dbManager.getChunkLayout(sameBody.map((p) => p.record.url))) {
				const rows = layouts.get(row.url) ?? [];
				rows.push(row);
				layouts.set(row.url, rows);
			}
		const unchanged = new Set(
			sameBody.filter((p) => matchesChunkLayout(p.chunks, layouts.get(p.record.url) ?? [])),
		);
		const changed = pages.filter((p) => !unchanged.has(p));
		const chunks = changed.flatMap((p) =>
			p.chunks.map((chunk) => ({ ...chunk, url: p.record.url })),
		);
		const embeddings = await createEmbeddings(
			chunks.map((c) => (c.title ? `${c.title}\n\n${c.content}` : c.content)),
			this.apiKey,
			this.recordUsage,
		).catch((error: unknown) => {
			const reason = error instanceof Error ? error.message : String(error);
			for (const page of changed)
				failures.push({ record: page.record, error: `Embedding failed: ${reason}` });
			return null;
		});
		const saved =
			embeddings && changed.length
				? await this.dbManager.batchUpdateFullRecords(
						changed.map((p) => ({
							...p.record,
							raw_json: p.raw_json,
							updated_at: new Date(),
							title: p.title,
							content: p.content,
						})),
						chunks.map((c, i) => ({ ...c, embedding: embeddings[i]! })),
					)
				: [];
		const savedUrls = new Set(saved);
		const nav = [...unchanged].filter(
			(p) =>
				p.raw_json &&
				!AppleAPIClient.isVideoUrl(p.record.url) &&
				(ids ||
					/^https:\/\/developer\.apple\.com\/documentation\/(swiftui|uikit)(\/|$)/.test(
						p.record.url,
					)),
		);
		if (nav.length)
			await this.dbManager.updateRawDocuments(
				nav.map((p) => ({
					id: p.record.id,
					collect_count: p.record.collect_count,
					json: p.raw_json!,
				})),
			);
		const removable = ids
			? []
			: failures.filter((f) => BatchErrorHandler.isPermanentError(f.error));
		const deleted = removable.length
			? await this.dbManager.deleteRecords(removable.map((f) => f.record))
			: 0;
		const failed = failures.filter((f) => !removable.includes(f));
		if (failed.length)
			await logger.warn(failed.map((f) => `${f.record.url} ${f.error}`).join("\n"));
		const updated = changed.filter(
			(p) => savedUrls.has(p.record.url) && p.record.content && p.record.content !== p.content,
		);
		if (updated.length && !this.config.forceUpdateAll)
			await notifyStats(
				`Content updated: ${updated.length} URLs\n${updated
					.slice(0, 10)
					.map((p) => p.record.url)
					.join("\n")}`,
			);
		const confirmed = await this.dbManager.recordChecks([
			...[...unchanged].map((p) => ({ record: p.record, outcome: "unchanged" as const })),
			...failed.map((f) => ({
				record: f.record,
				outcome:
					/^(?:UNSUPPORTED_DOCUMENT|NO_SUBTITLES|EMPTY_TRANSCRIPT|DOCUMENT_JSON_UNAVAILABLE):/.test(
						f.error,
					)
						? ("unavailable" as const)
						: ("retry" as const),
			})),
		]);
		const current = new Set(confirmed.map((r) => r.url));
		const unchangedCount = [...unchanged].filter((p) => current.has(p.record.url)).length;
		const failedCount = failed.filter((f) => current.has(f.record.url)).length;
		const summary = {
			claimed: records.length,
			updated: saved.length,
			unchanged: unchangedCount,
			failed: failedCount,
			deleted,
			stale: records.length - saved.length - unchangedCount - failedCount - deleted,
			totalChunks: chunks.filter((c) => savedUrls.has(c.url)).length,
		};
		logger.info(`Collector batch: ${JSON.stringify(summary)}`);
		return summary;
	}
}

export { AppleDocCollector };
