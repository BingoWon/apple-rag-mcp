import type { PageReader, StoredWebPage } from "../services/page-reader.js";
import type { ToolCallLogger } from "../services/tool-call-logger.js";

export interface RAGQuery {
	query: string;
	result_count?: number;
	signal?: AbortSignal;
}

export interface AdditionalUrl {
	url: string;
	title: string | null;
	characterCount: number;
}

export interface RAGResult {
	success: boolean;
	query: string;
	results: SearchResult[];
	additionalUrls: AdditionalUrl[];
	count: number;
	processing_time_ms: number;
	degradations: string[];
}

export interface SearchResult {
	id: string;
	url: string;
	title: string | null;
	content: string;
	contentLength: number;
	chunk_index: number;
	total_chunks: number;
	mergedChunkIndices?: number[];
}

export interface Services {
	rag: RAGService;
	pages: PageReader;
	database: DatabaseService;
	embedding: EmbeddingService;
	logger: ToolCallLogger;
	rateLimit: RateLimitService;
}

export interface RAGService {
	query(request: RAGQuery): Promise<RAGResult>;
}

export interface AuthContext {
	isAuthenticated: boolean;
	userId?: string;
	email?: string;
	credentialId?: string;
	sessionId?: string;
	authMethod?: "anonymous" | "token" | "ip" | "oauth" | "api_key";
}

export interface DatabaseService {
	semanticSearch(embedding: number[], options: SearchOptions): Promise<SearchResult[]>;
	keywordSearch(query: string, options: SearchOptions): Promise<SearchResult[]>;
	getPageByUrl(url: string): Promise<PageResult | null>;
	getCachedPage(url: string): Promise<StoredWebPage | null>;
	cachePage(requestedUrl: string, page: StoredWebPage): Promise<void>;
	reserveWebFetch(limit: number): Promise<boolean>;
	enqueuePage(url: string): Promise<void>;
	close(): Promise<void>;
}

export interface EmbeddingService {
	createEmbedding(
		text: string,
		signal?: AbortSignal,
		onFallback?: (reason: string) => void,
	): Promise<number[]>;
}

export interface SearchOptions {
	resultCount?: number;
	signal?: AbortSignal;
}

export interface PageResult {
	id: string;
	url: string;
	title: string | null;
	content: string;
}

export interface AppConfig {
	RAG_DB_HOST: string;
	RAG_DB_PORT: number;
	RAG_DB_DATABASE: string;
	RAG_DB_USER: string;
	RAG_DB_PASSWORD: string;
	RAG_DB_SSLMODE: string;
}

export interface RateLimitResult {
	allowed: boolean;
	limit: number;
	remaining: number;
	resetAt: string;
	planType: string;
	limitType: "weekly" | "minute";
	minuteLimit?: number;
	minuteRemaining?: number;
	minuteResetAt?: string;
	reservation?: {
		identifier: string;
		windows: Array<{ period: "weekly" | "minute"; windowStart: string }>;
	};
}

export interface RateLimitService {
	getStatus(clientIP: string, authContext: AuthContext): Promise<RateLimitResult>;
	checkLimits(clientIP: string, authContext: AuthContext): Promise<RateLimitResult>;
	refund(result: RateLimitResult): Promise<void>;
}

export type { D1Database, D1Result, ExecutionContext } from "@cloudflare/workers-types";
