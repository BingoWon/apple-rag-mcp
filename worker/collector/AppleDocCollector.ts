import type { ModelUsageRecorder } from "../services/model-usage.js";
import { AppleAPIClient } from "./AppleAPIClient.js";
import { chunkText } from "./Chunker.js";
import { ContentProcessor } from "./ContentProcessor.js";
import {
	createRemovedDocChange,
	type DetectedDocChange,
	detectDocumentChange,
} from "./change-detector.js";
import { createEmbeddings } from "./EmbeddingProvider.js";
import type { PostgreSQLManager } from "./PostgreSQLManager.js";
import type { BatchConfig, BatchResult, DatabaseRecord, DocumentContent } from "./types/index.js";
import { BatchErrorHandler } from "./utils/batch-error-handler.js";
import { logger } from "./utils/logger.js";
import { notifyStats } from "./utils/telegram-notifier.js";

function parseHttpDate(value: string | null | undefined): Date | null {
	if (!value) return null;
	const ms = Date.parse(value);
	return Number.isFinite(ms) ? new Date(ms) : null;
}

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
		return this.runBatch(records, "sweep", Boolean(ids));
	}

	async executeRadar(batchSize = 40) {
		const records = await this.dbManager.getRadarBatchRecords(batchSize);
		if (!records.length) {
			return {
				claimed: 0,
				notModified: 0,
				updated: 0,
				unchanged: 0,
				failed: 0,
				deleted: 0,
				stale: 0,
				totalChunks: 0,
				eventsRecorded: 0,
			};
		}
		return this.runBatch(records, "radar", false);
	}

	private async runBatch(
		records: DatabaseRecord[],
		sweepSource: "radar" | "sweep",
		isTargetedRecovery: boolean,
	) {
		const startedAt = new Date();
		const etags = new Map<string, string | null>();
		if (!this.config.forceUpdateAll && !isTargetedRecovery) {
			for (const r of records) {
				if (r.http_etag && r.content?.trim()) {
					etags.set(r.url, r.http_etag);
				}
			}
		}

		const [videos, docs] = await Promise.all([
			this.apiClient.fetchVideos(
				records.filter((r) => AppleAPIClient.isVideoUrl(r.url)).map((r) => r.url),
			),
			this.apiClient.fetchDocuments(
				records.filter((r) => !AppleAPIClient.isVideoUrl(r.url)).map((r) => r.url),
				undefined,
				etags,
			),
		]);

		const notModifiedUrls = new Set(docs.filter((r) => r.notModified).map((r) => r.url));
		const httpMeta = new Map(
			docs.map((r) => [
				r.url,
				{
					etag: r.etag ?? null,
					sourceModifiedAt: parseHttpDate(r.lastModified),
				},
			]),
		);

		const parsed = await this.contentProcessor.processDocuments(docs.filter((r) => r.data));
		const raw = new Map(docs.filter((r) => r.data).map((r) => [r.url, JSON.stringify(r.data)]));
		const results = new Map<string, BatchResult<DocumentContent>>();
		for (const r of docs)
			if (!r.data && !r.notModified)
				results.set(r.url, { url: r.url, data: null, error: r.error || "Missing response" });
		for (const r of parsed) results.set(r.url, r);
		for (const r of videos)
			results.set(r.url, { ...r, data: r.data ? { ...r.data, extractedUrls: [] } : null });

		const links = new Set<string>();
		const failures: { record: DatabaseRecord; error: string }[] = [];
		const pages = [];
		for (const record of records) {
			if (notModifiedUrls.has(record.url)) continue;
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
				raw_json: raw.get(record.url) ?? null,
				http_etag: httpMeta.get(record.url)?.etag ?? null,
				source_modified_at: httpMeta.get(record.url)?.sourceModifiedAt ?? null,
				chunks: chunkText(content, title),
			});
		}

		const newlyDiscovered = links.size
			? await this.dbManager.batchInsertUrls([...links]).catch((error) => {
					throw new Error(
						`PostgreSQL discovered URL sync failed: ${error instanceof Error ? error.message : error}`,
						{ cause: error },
					);
				})
			: 0;

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
			sameBody.filter((p) => {
				const stored = layouts.get(p.record.url) ?? [];
				return (
					stored.length === p.chunks.length &&
					stored.every((v, i) => {
						const c = p.chunks[i]!;
						return (
							v.indexed &&
							v.chunk_index === i &&
							v.total_chunks === c.total_chunks &&
							v.title === c.title &&
							v.content === c.content
						);
					})
				);
			}),
		);

		const changed = pages.filter((p) => !unchanged.has(p));
		const previousRawDocs =
			changed.length &&
			!this.config.forceUpdateAll &&
			typeof this.dbManager.getRawDocuments === "function"
				? await this.dbManager
						.getRawDocuments(
							changed.filter((p) => p.record.content?.trim()).map((p) => p.record.id),
						)
						.catch(() => new Map<string, unknown>())
				: new Map<string, unknown>();
		const chunks = changed.flatMap((p) =>
			p.chunks.map((chunk) => ({ ...chunk, url: p.record.url })),
		);
		const embeddings = await createEmbeddings(
			chunks.map((c) => (c.title ? `${c.title}\n\n${c.content}` : c.content)),
			this.apiKey,
			this.recordUsage,
		);
		const saved = changed.length
			? await this.dbManager.batchUpdateFullRecords(
					changed.map((p) => ({
						...p.record,
						raw_json: p.raw_json,
						http_etag: p.http_etag,
						source_modified_at: p.source_modified_at,
						updated_at: new Date(),
						title: p.title,
						content: p.content,
					})),
					chunks.map((c, i) => ({ ...c, embedding: embeddings[i]! })),
				)
			: [];
		const savedUrls = new Set(saved);

		const unchangedWithMeta = [...unchanged]
			.filter((p) => p.http_etag || p.source_modified_at)
			.map((p) => ({
				id: p.record.id,
				collect_count: p.record.collect_count,
				etag: p.http_etag,
				sourceModifiedAt: p.source_modified_at,
			}));
		if (unchangedWithMeta.length && typeof this.dbManager.updateHttpMetadata === "function") {
			await this.dbManager.updateHttpMetadata(unchangedWithMeta);
		}

		const nav = [...unchanged].filter(
			(p) =>
				p.raw_json &&
				/^https:\/\/developer\.apple\.com\/documentation\/(swiftui|uikit)(\/|$)/.test(p.record.url),
		);
		if (nav.length)
			await this.dbManager.updateRawDocuments(
				nav.map((p) => ({
					id: p.record.id,
					collect_count: p.record.collect_count,
					json: p.raw_json!,
				})),
			);

		const removable = isTargetedRecovery
			? []
			: failures.filter((f) => BatchErrorHandler.isPermanentError(f.error));
		const deleted = removable.length
			? await this.dbManager.deleteRecords(removable.map((f) => f.record))
			: 0;
		const failed = failures.filter((f) => !removable.includes(f));
		if (failed.length)
			await logger.warn(failed.map((f) => `${f.record.url} ${f.error}`).join("\n"));

		// Extract structured change events for all persisted changes and removals
		const changeEvents: DetectedDocChange[] = [];
		if (!this.config.forceUpdateAll) {
			for (const p of changed) {
				if (!savedUrls.has(p.record.url)) continue;
				const detected = detectDocumentChange({
					url: p.record.url,
					oldTitle: p.record.title,
					oldContent: p.record.content,
					oldRawJson: previousRawDocs.get(p.record.id),
					newTitle: p.title,
					newContent: p.content,
					newRawJson: p.raw_json,
					sweepSource,
					sourceModifiedAt: p.source_modified_at,
				});
				if (detected) changeEvents.push(detected);
			}
			if (deleted > 0) {
				for (const item of removable) {
					if (!item.record.content?.trim()) continue;
					changeEvents.push(
						createRemovedDocChange({
							url: item.record.url,
							title: item.record.title,
							sweepSource,
						}),
					);
				}
			}
		}

		let eventsRecorded = 0;
		if (changeEvents.length && typeof this.dbManager.recordChangeEvents === "function") {
			try {
				eventsRecorded = await this.dbManager.recordChangeEvents(changeEvents);
			} catch (error) {
				await logger.warn(
					`Failed to persist ${changeEvents.length} doc change events: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}

		const updated = changed.filter(
			(p) => savedUrls.has(p.record.url) && p.record.content && p.record.content !== p.content,
		);
		if (updated.length && !this.config.forceUpdateAll)
			await notifyStats(
				`Content updated (${sweepSource}): ${updated.length} URLs\n${updated
					.slice(0, 10)
					.map((p) => p.record.url)
					.join("\n")}`,
			);

		const summary = {
			claimed: records.length,
			notModified: notModifiedUrls.size,
			updated: saved.length,
			unchanged: unchanged.size + notModifiedUrls.size,
			failed: failed.length,
			deleted,
			stale: changed.length - saved.length + removable.length - deleted,
			totalChunks: chunks.filter((c) => savedUrls.has(c.url)).length,
			eventsRecorded,
		};

		if (typeof this.dbManager.recordCollectorRun === "function") {
			try {
				await this.dbManager.recordCollectorRun({
					startedAt,
					durationMs: Date.now() - startedAt.getTime(),
					sweepSource,
					claimed: summary.claimed,
					notModified: summary.notModified,
					updated: summary.updated,
					unchanged: summary.unchanged,
					added: newlyDiscovered,
					deleted: summary.deleted,
					failed: summary.failed,
					eventsRecorded,
				});
			} catch (error) {
				await logger.warn(
					`Failed to persist collector run log: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}

		logger.info(`Collector batch (${sweepSource}): ${JSON.stringify(summary)}`);
		return summary;
	}
}

export { AppleDocCollector };
