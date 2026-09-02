import postgres from "postgres";
import type { Env } from "../shared/types.js";
import { AppleDocCollector } from "./AppleDocCollector.js";
import { PostgreSQLManager } from "./PostgreSQLManager.js";
import type { BatchConfig } from "./types/index.js";
import { logger } from "./utils/logger.js";
import { configureTelegram, notifyStats } from "./utils/telegram-notifier.js";

export async function handleScheduled(env: Env): Promise<void> {
	configureTelegram(env.TELEGRAM_STATS_BOT_URL, env.TELEGRAM_ALERT_BOT_URL);
	logger.setAlertUrl(env.TELEGRAM_ALERT_BOT_URL);
	const shouldRunHourlyMaintenance = new Date().getUTCMinutes() < 5;

	try {
		if (shouldRunHourlyMaintenance) {
			await env.DB.prepare(
				`DELETE FROM usage_counters
				 WHERE (period = 'minute' AND window_start < datetime('now', '-2 days'))
				    OR (period = 'weekly' AND window_start < datetime('now', '-14 days'))`,
			).run();
		}
		await processAppleContent(env, shouldRunHourlyMaintenance);
	} catch (error) {
		await logger.error(
			`Worker execution failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		throw error;
	}
}

async function processAppleContent(env: Env, shouldDiscoverVideos: boolean): Promise<void> {
	const config: BatchConfig = {
		batchSize: Number.parseInt(env.BATCH_SIZE || "30", 10),
		forceUpdateAll: env.FORCE_UPDATE_ALL === "true",
	};
	const startTime = Date.now();

	logger.info(`Database connecting: ${env.RAG_DB_HOST}:${env.RAG_DB_PORT}/${env.RAG_DB_DATABASE}`);

	const sql = postgres({
		host: env.RAG_DB_HOST,
		port: Number.parseInt(env.RAG_DB_PORT || "5432", 10),
		database: env.RAG_DB_DATABASE,
		username: env.RAG_DB_USER,
		password: env.RAG_DB_PASSWORD || "",
		ssl: env.RAG_DB_SSLMODE === "require",
		max: 1,
		idle_timeout: 0,
		connect_timeout: 60,
		keep_alive: 30,
		connection: {
			application_name: "apple-rag-collector",
			statement_timeout: 120_000,
			lock_timeout: 60_000,
			idle_in_transaction_session_timeout: 180_000,
		},
		transform: { undefined: null },
		onnotice: () => {},
	});

	const dbManager = new PostgreSQLManager(sql);
	const collector = new AppleDocCollector(dbManager, env.DEEPINFRA_API_KEY, config);

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
				`${durationSeconds}s | ${config.batchSize} URLs | ${result.totalChunks} chunks\n\n` +
				`Docs: ${stats.docs.total} | ${stats.docs.collectedPercentage} collected\n` +
				`Videos: ${stats.videos.total} | ${stats.videos.collectedPercentage} collected\n` +
				`Chunks: ${stats.totalChunks} total | Avg collect: ${stats.avgCollectCount}\n` +
				`Range: ${stats.minCollectCount}-${stats.maxCollectCount}`;

			logger.info(statsMessage);
			await notifyStats(statsMessage);
		}
	} finally {
		await dbManager.close();
	}
}
