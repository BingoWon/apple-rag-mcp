/**
 * Shared type definitions for the Apple RAG Collector
 *
 * Pure batch processing architecture - never single processing
 * All type definitions are based on batch processing design
 */

// Batch processing configuration interface
interface BatchConfig {
	readonly batchSize: number;
	readonly forceUpdateAll: boolean;
}

// Application configuration interface
interface AppConfig {
	readonly database: {
		readonly host: string;
		readonly port: number;
		readonly database: string;
		readonly username: string;
		readonly password: string;
		readonly ssl: boolean;
	};
	readonly batchProcessing: BatchConfig;
	readonly logging: {
		readonly level: string;
	};
}

// Database record interface
interface DatabaseRecord {
	readonly id: string;
	readonly url: string;
	readonly raw_json: string | null;
	readonly title: string | null;
	readonly content: string;
	readonly collect_count: number;
	readonly created_at: Date;
	readonly updated_at: Date | null;
}

// Processed document content interface
interface DocumentContent {
	readonly title: string | null;
	readonly content: string;
	readonly extractedUrls: readonly string[];
}

// Video content interface (transcript)
interface VideoContent {
	readonly title: string | null;
	readonly content: string;
}

// Chunk record interface for vector storage
interface ChunkRecord {
	readonly id: string;
	readonly url: string;
	readonly title: string | null;
	readonly content: string;
	readonly created_at: Date;
	readonly embedding: number[] | null;
	readonly chunk_index: number;
	readonly total_chunks: number;
}

// Batch result interface - simplified to core types
interface BatchResult<T> {
	readonly url: string;
	readonly data: T | null;
	readonly error?: string;
}

// Apple API content section interface
interface ContentSection {
	readonly type: string;
	readonly content?: string;
	readonly text?: string;
	readonly title?: string;
	readonly anchor?: string;
	readonly level?: number;
}

// Apple API response interface
interface AppleAPIResponse {
	readonly metadata: {
		readonly title?: string;
		readonly roleHeading?: string;
		readonly platforms?: ReadonlyArray<{
			readonly name: string;
			readonly introducedAt: string;
			readonly deprecatedAt?: string;
			readonly beta?: boolean;
		}>;
	};
	readonly abstract?: ReadonlyArray<{
		readonly text: string;
	}>;
	readonly primaryContentSections?: ReadonlyArray<ContentSection>;
	readonly references?: Record<
		string,
		{
			readonly title?: string;
			readonly url?: string;
		}
	>;
}

// Statistics interface
interface DatabaseStats {
	// Pages breakdown
	readonly docs: {
		readonly total: number;
		readonly collected: number;
		readonly collectedPercentage: string;
	};
	readonly videos: {
		readonly total: number;
		readonly collected: number;
		readonly collectedPercentage: string;
	};
	// Combined stats
	readonly total: number;
	readonly avgCollectCount: number;
	readonly collectedCount: number;
	readonly collectedPercentage: string;
	readonly maxCollectCount: number;
	readonly minCollectCount: number;
	readonly collectCountDistribution: Record<string, { count: number; percentage: string }>;
	readonly totalChunks: number;
}

export type {
	AppConfig,
	AppleAPIResponse,
	BatchConfig,
	BatchResult,
	ChunkRecord,
	ContentSection,
	DatabaseRecord,
	DatabaseStats,
	DocumentContent,
	VideoContent,
};
