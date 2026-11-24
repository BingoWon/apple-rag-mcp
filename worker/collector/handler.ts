import postgres from "postgres";
import { createModelUsageRecorder, type ModelUsageRecorder } from "../services/model-usage.js";
import type { Env } from "../shared/types.js";
import { AppleDocCollector } from "./AppleDocCollector.js";
import { COLLECTOR_CONNECTION_PARAMETERS, PostgreSQLManager } from "./PostgreSQLManager.js";
import type { BatchConfig } from "./types/index.js";
import { logger } from "./utils/logger.js";
import { configureTelegram, notifyStats } from "./utils/telegram-notifier.js";

export async function handleScheduled(env: Env): Promise<void> {
	const modelUsage = createModelUsageRecorder(env.DB);
	configureTelegram(env.TELEGRAM_STATS_BOT_URL, env.TELEGRAM_ALERT_BOT_URL);
	logger.setAlertUrl(env.TELEGRAM_ALERT_BOT_URL);
	const shouldRunHourlyMaintenance = new Date().getUTCMinutes() < 5;

	try {
		if (shouldRunHourlyMaintenance) {
			await env.DB.prepare(
				"DELETE FROM quota_reservations WHERE created_at<unixepoch()-86400",
			).run();
			await env.DB.prepare("DELETE FROM oauth_attempts WHERE expires_at<=unixepoch()").run();
			await env.DB.prepare("DELETE FROM web_sessions WHERE expires_at<=unixepoch()").run();
			await env.DB.prepare(
				`DELETE FROM usage_counters
				 WHERE (period = 'minute' AND window_start < datetime('now', '-2 days'))
				    OR (period = 'weekly' AND window_start < datetime('now', '-14 days'))`,
			).run();
		}
		await processAppleContent(env, shouldRunHourlyMaintenance, modelUsage.record);
	} catch (error) {
		await logger.error(
			`Worker execution failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		throw error;
	} finally {
		await modelUsage.flush();
	}
}

async function processAppleContent(
	env: Env,
	shouldDiscoverVideos: boolean,
	recordUsage: ModelUsageRecorder,
): Promise<void> {
	const config: BatchConfig = {
		batchSize: Number.parseInt(env.BATCH_SIZE || "30", 10),
		forceUpdateAll: env.FORCE_UPDATE_ALL === "true",
	};
	const startTime = Date.now();

	logger.info(`Database connecting: ${env.RAG_DB_HOST}:${env.RAG_DB_PORT}/${env.RAG_DB_DATABASE}`);

	const createClient = () =>
		postgres({
			host: env.RAG_DB_HOST,
			port: Number.parseInt(env.RAG_DB_PORT || "5432", 10),
			database: env.RAG_DB_DATABASE,
			username: env.RAG_DB_USER,
			password: env.RAG_DB_PASSWORD || "",
			ssl: env.RAG_DB_SSLMODE !== "disable",
			max: 1,
			idle_timeout: 0,
			connect_timeout: 60,
			keep_alive: 30,
			connection: COLLECTOR_CONNECTION_PARAMETERS,
			transform: { undefined: null },
			onnotice: () => {},
		});

	const dbManager = new PostgreSQLManager(createClient);
	const collector = new AppleDocCollector(dbManager, env.DEEPINFRA_API_KEY, config, recordUsage);

	try {
		if (shouldDiscoverVideos) {
			try {
				const newVideos = await collector.discoverVideos();
				if (newVideos > 0) logger.info(`Discovered ${newVideos} new video URLs`);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				if (message.includes("HTTP 524")) logger.warn("Video discovery skipped (timeout)");
				else await logger.error(`Video discovery failed: ${message}`);
			}
		}

		logger.info(`Starting one batch of ${config.batchSize} URLs`);
		const result = await collector.execute();
		const durationSeconds = Math.round((Date.now() - startTime) / 1000);

		logger.info(
			`Collector completed in ${durationSeconds}s: ${result.totalChunks} chunks generated`,
		);

		if (shouldDiscoverVideos) {
			const stats = await dbManager.getStats();
			const statsMessage =
				`Collector Completed\n` +
				`${durationSeconds}s | ${result.claimed} claimed | ${result.updated} updated | ${result.unchanged} unchanged | ${result.failed} failed | ${result.deleted} removed | ${result.stale} superseded\n` +
				`Corpus: ${stats.docs_total} document URLs, ${stats.videos_total} video URLs\n` +
				`Readable pages: ${stats.readable_pages} | Indexed: ${stats.indexed_pages} | Chunks: ${stats.chunks_total}`;

			logger.info(statsMessage);
			await notifyStats(statsMessage);
		}
	} finally {
		await dbManager.close();
	}
}
