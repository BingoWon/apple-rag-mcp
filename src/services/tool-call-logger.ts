/**
 * Modern Tool Call Logger - Separated Search and Fetch Logging
 * Optimal solution with dedicated tables for different MCP tool call types
 */
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
  actualUrl?: string | null;
  pageId?: string | null;
  responseTimeMs: number;
  statusCode?: number;
  errorCode?: string | null;
  ipAddress?: string;
  countryCode?: string | null;
}

export class ToolCallLogger {
  private d1: D1Database;

  constructor(d1: D1Database) {
    this.d1 = d1;
  }

  /**
   * Log search operation to D1 database (async, non-blocking)
   */
  async logSearch(entry: SearchLogEntry): Promise<void> {
    try {
      await this.executeSearchLog(entry);
    } catch (error) {
      logger.error(
        `Search log failed: ${error instanceof Error ? error.message : String(error)} (userId: ${entry.userId})`
      );
      // 不重新抛出错误，避免影响主流程
    }
  }

  /**
   * Log fetch operation to D1 database (async, non-blocking)
   */
  async logFetch(entry: FetchLogEntry): Promise<void> {
    try {
      await this.executeFetchLog(entry);
    } catch (error) {
      logger.error(
        `Fetch log failed: ${error instanceof Error ? error.message : String(error)} (userId: ${entry.userId})`
      );
      // 不重新抛出错误，避免影响主流程
    }
  }

  /**
   * Execute search log operation with environment-aware connection
   */
  private async executeSearchLog(entry: SearchLogEntry): Promise<void> {
    try {
      const now = new Date().toISOString();
      const result = await this.d1
        .prepare(
          `INSERT INTO search_logs
         (user_id, mcp_token, requested_query, actual_query, result_count, response_time_ms, status_code, error_code, ip_address, country_code, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          entry.userId,
          entry.mcpToken,
          entry.requestedQuery,
          entry.actualQuery,
          entry.resultCount,
          entry.responseTimeMs,
          entry.statusCode,
          entry.errorCode || null,
          entry.ipAddress || null,
          entry.countryCode || null,
          now
        )
        .run();

      if (!result.success) {
        throw new Error("D1 search log execution failed");
      }
    } catch (error) {
      throw new Error(
        `D1 search logging failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Execute fetch log operation with environment-aware connection
   */
  private async executeFetchLog(entry: FetchLogEntry): Promise<void> {
    try {
      const now = new Date().toISOString();
      const result = await this.d1
        .prepare(
          `INSERT INTO fetch_logs
         (user_id, mcp_token, requested_url, actual_url, page_id, response_time_ms, status_code, error_code, ip_address, country_code, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          entry.userId,
          entry.mcpToken,
          entry.requestedUrl,
          entry.actualUrl || null,
          entry.pageId || null,
          entry.responseTimeMs,
          entry.statusCode,
          entry.errorCode || null,
          entry.ipAddress || null,
          entry.countryCode || null,
          now
        )
        .run();

      if (!result.success) {
        throw new Error("D1 fetch log execution failed");
      }
    } catch (error) {
      throw new Error(
        `D1 fetch logging failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
