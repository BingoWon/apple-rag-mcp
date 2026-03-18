import { AuthMiddleware } from "../mcp-auth/auth-middleware.js";
import type { AppConfig, Services } from "../mcp-types/index.js";
import type { Env } from "../shared/types.js";
import { RAGService } from "./rag.js";
import { RateLimitService } from "./rate-limit.js";
import { ToolCallLogger } from "./tool-call-logger.js";

export async function createServices(env: Env): Promise<Services> {
	try {
		// Convert Worker env to app config
		const config = createAppConfig(env);

		// Initialize services
		const auth = new AuthMiddleware(env.DB);
		const rag = new RAGService(config, env);
		const rateLimit = new RateLimitService(env.DB);
		const logger = new ToolCallLogger(env.DB);

		return {
			rag,
			auth,
			database: rag.database,
			embedding: rag.embedding,
			rateLimit,
			logger,
		};
	} catch (error) {
		// Import logger here to avoid circular dependency
		const { logger } = await import("../mcp-utils/logger.js");
		logger.error(
			`Service initialization failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		throw error;
	}
}

function createAppConfig(env: Env): AppConfig {
	return {
		RAG_DB_HOST: env.RAG_DB_HOST,
		RAG_DB_PORT: parseInt(env.RAG_DB_PORT, 10),
		RAG_DB_DATABASE: env.RAG_DB_DATABASE,
		RAG_DB_USER: env.RAG_DB_USER,
		RAG_DB_PASSWORD: env.RAG_DB_PASSWORD,
		RAG_DB_SSLMODE: env.RAG_DB_SSLMODE,
	};
}
