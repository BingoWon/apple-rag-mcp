import type { AppleAPIResponse } from "../types/index.js";

/**
 * URL processing utility for Apple Developer documentation
 * Handles URL extraction, validation, normalization, and deduplication
 */
class UrlProcessor {
	private static readonly BASE_URL = "https://developer.apple.com" as const;

	/**
	 * Extract and process URLs from Apple API response
	 */
	extractAllUrls(docData: AppleAPIResponse): string[] {
		if (!docData.references) return [];

		const rawUrls = Object.values(docData.references)
			.filter((ref) => ref?.url)
			.map((ref) => (ref.url!.startsWith("http") ? ref.url! : `${UrlProcessor.BASE_URL}${ref.url}`))
			.filter(
				(url) =>
					url.startsWith("https://developer.apple.com/documentation") ||
					url.startsWith("https://developer.apple.com/design"),
			);

		// Apply URL processing pipeline: filter malformed → normalize → deduplicate
		const filteredUrls = this.filterMalformedUrls(rawUrls);
		const normalizedUrls = this.cleanAndNormalizeUrlsBatch(filteredUrls);

		return [...new Set(normalizedUrls)];
	}

	/**
	 * Batch clean and normalize URLs - elegant, modern, and concise
	 */
	private cleanAndNormalizeUrlsBatch(urls: string[]): string[] {
		const normalizeUrl = (url: string): string => {
			try {
				const parsed = new URL(url);
				// Preserve case sensitivity for Apple Developer paths
				const normalizedPath = parsed.pathname === "/" ? "/" : parsed.pathname.replace(/\/+$/, ""); // Remove trailing slashes except root

				return `${parsed.protocol.toLowerCase()}//${parsed.hostname.toLowerCase()}${normalizedPath}`;
			} catch (_error) {
				// Return original URL if parsing fails
				return url;
			}
		};

		return urls.map(normalizeUrl);
	}

	/**
	 * Filter malformed URLs - global optimal solution
	 */
	private filterMalformedUrls(urls: string[]): string[] {
		const isValidUrl = (url: string): boolean => {
			return ![
				url.split("https://").length > 2 || url.split("http://").length > 2, // Duplicate protocol
				url.includes("%ef%bb%bf") || url.includes("\ufeff"), // BOM characters
				url.split("/documentation/").length > 2, // Path duplication
				url.includes("https:/") && !url.startsWith("https://"), // Protocol format error
				url.length > 200, // Abnormal length
				url.split("developer.apple.com").length > 2, // Duplicate domain
			].some(Boolean);
		};

		const validUrls = urls.filter(isValidUrl);
		// const filteredCount = urls.length - validUrls.length;

		// if (filteredCount > 0) {
		//   console.info(
		//     `Filtered ${filteredCount} malformed URLs from ${urls.length} total`
		//   );
		// }

		return validUrls;
	}
}

export { UrlProcessor };
