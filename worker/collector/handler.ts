import postgres from "postgres";
import type { Env } from "../shared/types.js";
import { AppleDocCollector } from "./AppleDocCollector.js";
import { PostgreSQLManager } from "./PostgreSQLManager.js";
import type { BatchConfig } from "./types/index.js";
import { logger } from "./utils/logger.js";
import { configureTelegram, notifyStats } from "./utils/telegram-notifier.js";

export async function handleScheduled(env: Env): Promise<void> {
	configureTelegram(env.TELEGRAM_STATS_BOT_URL, env.TELEGRAM_ALERT_BOT_URL);

	try {
		await processAppleContent(env);
	} catch (error) {
		await logger.error(
			`Worker execution failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		throw error;
	}
}

async function processAppleContent(env: Env): Promise<void> {
	const config: BatchConfig = {
		batchSize: Number.parseInt(env.BATCH_SIZE || "30", 10),
		forceUpdateAll: env.FORCE_UPDATE_ALL === "true",
	};

	logger.info(`Database connecting: ${env.RAG_DB_HOST}:${env.RAG_DB_PORT}/${env.RAG_DB_DATABASE}`);

	const sql = postgres({
		host: env.RAG_DB_HOST,
		port: Number.parseInt(env.RAG_DB_PORT || "5432", 10),
		database: env.RAG_DB_DATABASE,
		username: env.RAG_DB_USER,
		password: env.RAG_DB_PASSWORD || "",
		ssl: env.RAG_DB_SSLMODE !== "disable",
		max: 3,
		idle_timeout: 30,
		connect_timeout: 60,
		transform: {
			undefined: null,
		},
		onnotice: () => {},
	});

	await sql`SET statement_timeout = '120s'`;
	await sql`SET lock_timeout = '60s'`;
	await sql`SET idle_in_transaction_session_timeout = '180s'`;

	const dbManager = new PostgreSQLManager(sql);
	const collector = new AppleDocCollector(dbManager, env.DEEPINFRA_API_KEY, config);

	const batchCount = Number.parseInt(env.BATCH_COUNT || "30", 10);
	const startTime = Date.now();

	try {
		const newVideos = await collector.discoverVideos();
		if (newVideos > 0) {
			logger.info(`Discovered ${newVideos} new video URLs`);
		}
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		if (msg.includes("HTTP 524")) {
			logger.warn("Video discovery skipped (timeout)");
		} else {
			await logger.error(`Video discovery failed: ${msg}`);
		}
	}

	logger.info(
		`Starting ${batchCount} batches x ${config.batchSize} URLs = ${config.batchSize * batchCount} total`,
	);

	let totalChunksGenerated = 0;

	for (let i = 0; i < batchCount; i++) {
		try {
			const result = await collector.execute();
			totalChunksGenerated += result.totalChunks;

			if (i === 0 || (i + 1) % 10 === 0 || i === batchCount - 1) {
				logger.info(`Batch ${i + 1}/${batchCount} completed: ${result.totalChunks} chunks`);
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			const errorStack = error instanceof Error ? error.stack : undefined;

			await logger.error(
				`Batch ${i + 1}/${batchCount} Failed\n` +
					`Error: ${errorMessage}\n` +
					`Stack: ${errorStack?.substring(0, 300) || "N/A"}\n` +
					"Status: Continuing...",
			);
		}
	}

	const endTime = Date.now();
	const durationMs = endTime - startTime;
	const durationMinutes = Math.floor(durationMs / 60000);
	const durationSeconds = Math.floor((durationMs % 60000) / 1000);

	logger.info(
		`Completed ${batchCount} batches in ${durationMinutes}m ${durationSeconds}s, ${totalChunksGenerated} chunks`,
	);

	const now = new Date();
	const currentMinute = now.getMinutes();

	if (currentMinute < 5) {
		try {
			const stats = await dbManager.getStats();

			const statsMessage =
				`Collector Completed\n` +
				`${durationMinutes}m ${durationSeconds}s | ${totalChunksGenerated} chunks\n\n` +
				`Docs: ${stats.docs.total} | ${stats.docs.collectedPercentage} collected\n` +
				`Videos: ${stats.videos.total} | ${stats.videos.collectedPercentage} collected\n` +
				`Chunks: ${stats.totalChunks} total | Avg collect: ${stats.avgCollectCount}\n` +
				`Range: ${stats.minCollectCount}-${stats.maxCollectCount}\n\n` +
				`Config: ${config.batchSize}x${batchCount}=${config.batchSize * batchCount} URLs | Force: ${config.forceUpdateAll ? "Y" : "N"}`;

			logger.info(statsMessage);
			await notifyStats(statsMessage);
		} catch (error) {
			await logger.error(
				`Stats retrieval failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	await dbManager.close();
}
