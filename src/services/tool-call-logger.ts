/**
 * Tool Call Logger with background D1 writes
 */

import { backgroundD1Write } from "../utils/d1-utils.js";
import { logger } from "../utils/logger.js";

export interface SearchLogEntry {
  userId: string;
  mcpToken?: string | null;
  requestedQuery: string;
  actualQuery: string;
  resultCount: number;
  responseTimeMs: number;
  statusCode?: number;
  errorCode?: string | null;
  ipAddress?: string;
  countryCode?: string | null;
}

export interface FetchLogEntry {
  userId: string;
  mcpToken?: string | null;
  requestedUrl: string;
  actualUrl: string;
  pageId?: string | null;
  responseTimeMs: number;
  statusCode?: number;
  errorCode?: string | null;
  ipAddress?: string;
  countryCode?: string | null;
}

export class ToolCallLogger {
  constructor(private d1: D1Database) {}

  logSearch(entry: SearchLogEntry): void {
    backgroundD1Write(
      logger.getContext(),
      () => this.insertSearchLog(entry),
      "search_log"
    );
  }

  logFetch(entry: FetchLogEntry): void {
    backgroundD1Write(
      logger.getContext(),
      () => this.insertFetchLog(entry),
      "fetch_log"
    );
  }

  private async insertSearchLog(entry: SearchLogEntry): Promise<void> {
    await this.d1
      .prepare(
        `INSERT INTO search_logs
         (user_id, mcp_token, requested_query, actual_query, result_count, response_time_ms, status_code, error_code, ip_address, country_code, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        entry.userId,
        entry.mcpToken ?? null,
        entry.requestedQuery,
        entry.actualQuery,
        entry.resultCount,
        entry.responseTimeMs,
        entry.statusCode ?? 200,
        entry.errorCode ?? null,
        entry.ipAddress ?? null,
        entry.countryCode ?? null,
        new Date().toISOString()
      )
      .run();
  }

  private async insertFetchLog(entry: FetchLogEntry): Promise<void> {
    await this.d1
      .prepare(
        `INSERT INTO fetch_logs
         (user_id, mcp_token, requested_url, actual_url, page_id, response_time_ms, status_code, error_code, ip_address, country_code, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        entry.userId,
        entry.mcpToken ?? null,
        entry.requestedUrl,
        entry.actualUrl,
        entry.pageId ?? null,
        entry.responseTimeMs,
        entry.statusCode ?? 200,
        entry.errorCode ?? null,
        entry.ipAddress ?? null,
        entry.countryCode ?? null,
        new Date().toISOString()
      )
      .run();
  }
}
