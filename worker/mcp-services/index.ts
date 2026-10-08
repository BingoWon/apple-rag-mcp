import { AuthMiddleware } from "../mcp-auth/auth-middleware.js";
import type { AppConfig, Services } from "../mcp-types/index.js";
import type { WaitUntilContext } from "../mcp-utils/d1-utils.js";
import { logger } from "../mcp-utils/logger.js";
import type { Env } from "../shared/types.js";
import { RAGService } from "./rag.js";
import { RateLimitService } from "./rate-limit.js";
import { ToolCallLogger } from "./tool-call-logger.js";

export async function createServices(env: Env, ctx: WaitUntilContext): Promise<Services> {
	try {
		const rag = new RAGService(createAppConfig(env), env, ctx);
		const rateLimit = new RateLimitService(env.DB);
		const logger = new ToolCallLogger(env.DB, ctx);

		return {
			rag,
			auth: new AuthMiddleware(env.DB, ctx),
			database: rag.database,
			embedding: rag.embedding,
			rateLimit,
			logger,
		};
	} catch (error) {
		await logger.error(
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
