/**
 * URL processing utility for Apple Developer documentation
 * Handles URL validation, normalization, and malformed URL detection
 */

export interface UrlValidationResult {
  isValid: boolean;
  normalizedUrl: string;
  error?: string;
}

/**
 * Validates and normalizes a single URL using elegant malformed URL detection
 * Integrates the sophisticated filtering logic for comprehensive validation
 */
export function validateAndNormalizeUrl(url: string): UrlValidationResult {
  // Basic validation
  if (!url || typeof url !== "string" || url.trim().length === 0) {
    return {
      isValid: false,
      normalizedUrl: url,
      error: "URL is required",
    };
  }

  // Apply malformed URL detection - global optimal solution
  const isValidUrl = ![
    url.split("https://").length > 2 || url.split("http://").length > 2, // Duplicate protocol
    url.includes("%ef%bb%bf") || url.includes("\ufeff"), // BOM characters
    url.split("/documentation/").length > 2, // Path duplication
    url.includes("https:/") && !url.startsWith("https://"), // Protocol format error
    url.length > 200, // Abnormal length
    url.split("developer.apple.com").length > 2, // Duplicate domain
  ].some(Boolean);

  if (!isValidUrl) {
    return {
      isValid: false,
      normalizedUrl: url,
      error: "URL contains malformed patterns",
    };
  }

  // Clean and normalize URL - elegant, modern, and concise
  try {
    const parsed = new URL(url);
    // Preserve case sensitivity for Apple Developer paths
    const normalizedPath =
      parsed.pathname === "/" ? "/" : parsed.pathname.replace(/\/+$/, ""); // Remove trailing slashes except root

    // Remove query parameters and fragments to match pages table format
    const normalizedUrl = `${parsed.protocol.toLowerCase()}//${parsed.hostname.toLowerCase()}${normalizedPath}`;

    return {
      isValid: true,
      normalizedUrl,
    };
  } catch {
    return {
      isValid: false,
      normalizedUrl: url,
      error: "Invalid URL format",
    };
  }
}
