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

// Database record interface
interface DatabaseRecord {
	readonly id: string;
	readonly url: string;
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

export type {
	AppleAPIResponse,
	BatchConfig,
	BatchResult,
	ContentSection,
	DatabaseRecord,
	DocumentContent,
	VideoContent,
};
