/**
 * Query Cleaner Utility
 * Cleans search queries by removing temporal information like dates and times
 */

import { logger } from "../shared/logger.js";

/**
 * Regular expressions for detecting and removing temporal information
 */
const TEMPORAL_PATTERNS = [
	// Explicit calendar date patterns first (before standalone years) so YYYY-MM-DD is removed intact;
	// slash or hyphen only so dot-separated semantic versions like 18.2.10 stay intact.
	/\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b/g,
	/\b\d{1,2}[/-]\d{1,2}[/-](?:19|20)?\d{2}\b/g,

	// Seasonal and quarter references with years (before standalone years)
	/\b(spring|summer|fall|autumn|winter)\s+(19|20)\d{2}\b/gi,
	/\bQ[1-4]\s+(19|20)\d{2}\b/gi,

	// "May" and abbreviated months only when paired with a day or 4-digit year (before standalone years)
	/\b(?:May|(?:Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?)\s+(?:\d{1,2}(?:st|nd|rd|th)?|(?:19|20)\d{2})\b/gi,
	/\b\d{1,2}(?:st|nd|rd|th)?\s+(?:May|(?:Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?)\b/gi,

	// Unambiguous full month names (exclude "May", which is a common English modal verb)
	/\b(January|February|March|April|June|July|August|September|October|November|December)(?:\s+\d{1,2}(?:st|nd|rd|th)?)?\b/gi,

	// Standalone years (4 digits, 1900-2099) - but NOT when part of technical versions or conferences
	/\b(?<!iOS\s)(?<!iPadOS\s)(?<!macOS\s)(?<!watchOS\s)(?<!tvOS\s)(?<!visionOS\s)(?<!Swift\s)(?<!Xcode\s)(?<!version\s)(?<!WWDC\s)(?<!Event\s)(?<!Conference\s)(?<!Keynote\s)(19|20)\d{2}\b/gi,

	// Explicit clock times (require AM/PM or seconds so aspect ratios like 16:10 stay intact)
	/\b\d{1,2}:\d{2}:\d{2}(?:\s*(?:AM|PM))?\b/gi,
	/\b\d{1,2}:\d{2}\s*(?:AM|PM)\b/gi,

	// Relative time expressions
	/\b(today|tomorrow|yesterday|this\s+(week|month|year)|last\s+(week|month|year)|next\s+(week|month|year))\b/gi,
];

/**
 * Unambiguous meta-descriptive filler words that hurt PostgreSQL keyword AND matching.
 * Technical terms like "reference" (weak reference), "guide" (layout guide),
 * "manual" (manual memory management), and "doc" (DocC / document) are preserved.
 */
const META_DESCRIPTIVE_PATTERNS = [
	/\b(documentation|tutorial)\b/gi,
	/\b(example|examples)\b(?!\s+(code|project|app))/gi,
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
	if (cleanedQuery !== originalQuery && cleanedQuery.length < originalQuery.length * 0.8) {
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
export function isCleanedQueryValid(cleanedQuery: string, originalQuery: string): boolean {
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
