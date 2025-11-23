/**
 * Modern TypeScript definitions for Cloudflare Worker MCP Server
 * Optimized for performance and type safety
 */

import type { ToolCallLogger } from "../services/tool-call-logger.js";

// Worker Environment
export interface WorkerEnv {
  // D1 Database binding
  DB: D1Database;

  // RAG Database connection (PostgreSQL)
  RAG_DB_HOST: string;
  RAG_DB_PORT: string;
  RAG_DB_DATABASE: string;
  RAG_DB_USER: string;
  RAG_DB_PASSWORD: string;
  RAG_DB_SSLMODE: string;

  // Telegram Bot
  TELEGRAM_BOT_URL: string;

  // DeepInfra
  DEEPINFRA_API_KEY: string;
}

// MCP Protocol Types
export interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: unknown;
}

export interface MCPNotification {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
}

// Tool Types
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

// RAG Types
export interface RAGQuery {
  query: string;
  result_count?: number;
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

// Service Types
export interface Services {
  rag: RAGService;
  auth: { optionalAuth(request: Request): Promise<AuthContext> };
  database: DatabaseService;
  embedding: EmbeddingService;
  logger: ToolCallLogger;
  rateLimit: RateLimitService;
}

export interface RAGService {
  query(request: RAGQuery): Promise<RAGResult>;
  initialize(): Promise<void>;
}

export interface AuthContext {
  isAuthenticated: boolean;
  userId?: string;
  email?: string;
  token?: string;
}

export interface DatabaseService {
  semanticSearch(
    embedding: number[],
    options: SearchOptions
  ): Promise<SearchResult[]>;
  keywordSearch(query: string, options: SearchOptions): Promise<SearchResult[]>;
  getPageByUrl(url: string): Promise<PageResult | null>;
  initialize(): Promise<void>;
}

export interface EmbeddingService {
  createEmbedding(text: string): Promise<number[]>;
}

export interface SearchOptions {
  resultCount?: number;
}

export interface PageResult {
  id: string;
  url: string;
  title: string | null;
  content: string;
}

// Configuration Types
export interface AppConfig {
  NODE_ENV?: "development" | "production";
  RAG_DB_HOST: string;
  RAG_DB_PORT: number;
  RAG_DB_DATABASE: string;
  RAG_DB_USER: string;
  RAG_DB_PASSWORD: string;
  RAG_DB_SSLMODE: string;
  PORT?: number;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_D1_DATABASE_ID?: string;
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
}

export interface RateLimitService {
  checkLimits(
    clientIP: string,
    authContext: AuthContext
  ): Promise<RateLimitResult>;
}

// Re-export Cloudflare types
export type {
  D1Database,
  D1Result,
  ExecutionContext,
} from "@cloudflare/workers-types";
