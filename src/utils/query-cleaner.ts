/**
 * Query Cleaner Utility
 * Cleans search queries by removing temporal information like dates and times
 */

import { logger } from "./logger.js";

/**
 * Regular expressions for detecting and removing temporal information
 */
const TEMPORAL_PATTERNS = [
  // Standalone years (4 digits, 1900-2099) - but NOT when part of technical versions or conferences
  /\b(?<!iOS\s)(?<!iPadOS\s)(?<!macOS\s)(?<!watchOS\s)(?<!tvOS\s)(?<!visionOS\s)(?<!Swift\s)(?<!Xcode\s)(?<!version\s)(?<!WWDC\s)(?<!Event\s)(?<!Conference\s)(?<!Keynote\s)(19|20)\d{2}\b/gi,

  // Months (full names)
  /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/gi,

  // Months (abbreviated)
  /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\b/gi,

  // Date patterns (MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, etc.)
  /\b\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}\b/g,
  /\b\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2}\b/g,

  // Time patterns (HH:MM, HH:MM:SS, with optional AM/PM)
  /\b\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM|am|pm)?\b/g,

  // Relative time expressions
  /\b(today|tomorrow|yesterday|this\s+(week|month|year)|last\s+(week|month|year)|next\s+(week|month|year))\b/gi,

  // Seasonal references with years
  /\b(spring|summer|fall|autumn|winter)\s+(19|20)\d{2}\b/gi,

  // Quarter references with years
  /\bQ[1-4]\s+(19|20)\d{2}\b/gi,

  // Ordinal dates (1st, 2nd, 3rd, etc.) - but not version numbers
  /\b\d{1,2}(st|nd|rd|th)(?!\s*(version|release))\b/gi,
];

/**
 * Meta-descriptive words that reduce Apple docs search precision
 * Note: Programming language keywords (enum, struct, class, type, protocol)
 * are NOT filtered as they represent core concepts users explicitly search for
 */
const META_DESCRIPTIVE_PATTERNS = [
  /\b(documentation|docs?|reference|manual|guide|tutorial)\b/gi,
  /\b(example|examples|sample)\b(?!\s+(code|project|app))/gi,
];

/**
 * Additional patterns for cleaning up extra spaces and punctuation
 */
const CLEANUP_PATTERNS = [
  // Multiple spaces
  /\s+/g,

  // Leading/trailing spaces
  /^\s+|\s+$/g,

  // Multiple punctuation
  /[,\s]+,/g,
  /\s+,/g,
];

/**
 * Clean a search query by removing temporal information and meta-descriptive words
 */
export function cleanQuery(query: string): string {
  if (!query || typeof query !== "string") {
    return "";
  }

  let cleanedQuery = query;
  const originalQuery = query;

  // Remove temporal patterns
  for (const pattern of TEMPORAL_PATTERNS) {
    cleanedQuery = cleanedQuery.replace(pattern, " ");
  }

  // Remove meta-descriptive words
  for (const pattern of META_DESCRIPTIVE_PATTERNS) {
    cleanedQuery = cleanedQuery.replace(pattern, " ");
  }

  // Clean up spaces and punctuation
  cleanedQuery = cleanedQuery.replace(CLEANUP_PATTERNS[0], " ");
  cleanedQuery = cleanedQuery.replace(CLEANUP_PATTERNS[1], "");
  cleanedQuery = cleanedQuery.replace(CLEANUP_PATTERNS[2], ",");
  cleanedQuery = cleanedQuery.replace(CLEANUP_PATTERNS[3], ",");

  // Remove empty brackets
  cleanedQuery = cleanedQuery.replace(/\(\s*\)/g, "");
  cleanedQuery = cleanedQuery.replace(/\[\s*\]/g, "");
  cleanedQuery = cleanedQuery.replace(/\{\s*\}/g, "");

  cleanedQuery = cleanedQuery.trim();

  // Log significant changes
  if (
    cleanedQuery !== originalQuery &&
    cleanedQuery.length < originalQuery.length * 0.8
  ) {
    logger.info(`Query cleaned: "${originalQuery}" -> "${cleanedQuery}"`);
  }

  return cleanedQuery;
}

/**
 * Validate that the cleaned query is still meaningful
 * @param cleanedQuery - The query after cleaning
 * @param originalQuery - The original query before cleaning
 * @returns True if the cleaned query is still meaningful, false otherwise
 */
export function isCleanedQueryValid(
  cleanedQuery: string,
  originalQuery: string
): boolean {
  // If cleaned query is empty or too short, it might not be meaningful
  if (!cleanedQuery || cleanedQuery.length < 2) {
    return false;
  }

  // If we removed more than 80% of the original query, it might be problematic
  if (cleanedQuery.length < originalQuery.length * 0.2) {
    return false;
  }

  // Check if we still have some meaningful content (letters)
  if (!/[a-zA-Z]/.test(cleanedQuery)) {
    return false;
  }

  return true;
}

/**
 * Clean query with fallback to original if cleaning removes too much content
 */
export function cleanQuerySafely(query: string): string {
  const cleaned = cleanQuery(query);

  if (isCleanedQueryValid(cleaned, query)) {
    return cleaned;
  }

  logger.info(`Query cleaning too aggressive for "${query}", using original`);
  return query;
}
