import type { AppleAPIResponse, BatchResult, VideoContent } from "./types/index.js";
import { BatchErrorHandler } from "./utils/batch-error-handler.js";

class AppleAPIClient {
	private static readonly PERMANENT_ERROR_CODES = [403, 404, 410];
	private static readonly DEFAULT_HEADERS = {
		Accept: "application/json",
		"User-Agent":
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0",
		"Accept-Language": "en-US,en;q=0.9",
		"Cache-Control": "no-cache",
	};
	private static readonly API_ENDPOINTS = {
		docc: "https://www.swift.org/data/documentation",
		default: "https://developer.apple.com/tutorials/data",
	};
	private static readonly ALL_VIDEOS_URL = "https://developer.apple.com/videos/all-videos/";
	private static readonly VIDEO_URL_PREFIX = "https://developer.apple.com/videos/play/";

	static isVideoUrl(url: string): boolean {
		return url.startsWith(AppleAPIClient.VIDEO_URL_PREFIX);
	}

	/**
	 * Discover all video URLs from Apple Developer Videos
	 */
	async discoverVideoUrls(): Promise<string[]> {
		const response = await fetch(AppleAPIClient.ALL_VIDEOS_URL, {
			headers: {
				...AppleAPIClient.DEFAULT_HEADERS,
				Accept: "text/html",
			},
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch all-videos page: HTTP ${response.status}`);
		}

		const html = await response.text();
		const pattern = /href="(\/videos\/play\/[^"]+)"/g;
		const matches = html.matchAll(pattern);
		const urls = [...matches].map(
			(match) => `https://developer.apple.com${match[1]!.replace(/\/$/, "")}`,
		);

		return [...new Set(urls)]; // Deduplicate
	}

	/**
	 * Fetch video transcripts
	 */
	async fetchVideos(urls: string[]): Promise<BatchResult<VideoContent>[]> {
		return await Promise.all(urls.map((url) => this.fetchSingleVideo(url)));
	}

	private async fetchSingleVideo(videoUrl: string): Promise<BatchResult<VideoContent>> {
		return BatchErrorHandler.safeExecute(videoUrl, async () => {
			const response = await fetch(videoUrl, {
				headers: {
					...AppleAPIClient.DEFAULT_HEADERS,
					Accept: "text/html",
				},
			});

			if (AppleAPIClient.PERMANENT_ERROR_CODES.includes(response.status)) {
				throw new Error(`PERMANENT_ERROR:${response.status}:${videoUrl}`);
			}

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const html = await response.text();

			// Extract title
			const titleMatch = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/);
			const title = titleMatch?.[1] ?? "";

			// Extract transcript - error if not found
			const transcriptMatch = html.match(/<section id="transcript-content">([\s\S]*?)<\/section>/);
			if (!transcriptMatch) {
				throw new Error(`PERMANENT_ERROR:NO_TRANSCRIPT:${videoUrl}`);
			}

			const segmentPattern = /data-start="[0-9.]+"[^>]*>([^<]*)/g;
			const segmentMatches = transcriptMatch[1]!.matchAll(segmentPattern);
			const segments = [...segmentMatches].map((m) => m[1]!.trim()).filter((text) => text);

			if (segments.length === 0) {
				throw new Error(`PERMANENT_ERROR:EMPTY_TRANSCRIPT:${videoUrl}`);
			}

			return { title: title || null, content: segments.join(" ") };
		});
	}

	async fetchDocuments(urls: string[]): Promise<BatchResult<AppleAPIResponse>[]> {
		return await Promise.all(urls.map((url) => this.fetchSingleDocument(url)));
	}

	private async fetchSingleDocument(documentUrl: string): Promise<BatchResult<AppleAPIResponse>> {
		const result = await BatchErrorHandler.safeExecute(documentUrl, async () => {
			const url = this.convertUrlToJsonApi(documentUrl);
			const response = await fetch(url, {
				headers: AppleAPIClient.DEFAULT_HEADERS,
			});

			if (AppleAPIClient.PERMANENT_ERROR_CODES.includes(response.status)) {
				throw new Error(`PERMANENT_ERROR:${response.status}:${documentUrl}`);
			}

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = (await response.json()) as AppleAPIResponse;
			this.validateDocumentData(data);
			return data;
		});

		return result;
	}

	private convertUrlToJsonApi(url: string): string {
		try {
			const urlObj = new URL(url);
			const path = urlObj.pathname.replace(/\/$/, "");

			// Special case for specific URL that needs swift.org endpoint
			if (
				url ===
				"https://developer.apple.com/documentation/xcode/formatting-your-documentation-content"
			) {
				// Convert to docc path for swift.org endpoint
				const doccPath = path.replace(/^\/documentation\/xcode/, "/docc");
				return `${AppleAPIClient.API_ENDPOINTS.docc}${doccPath}.json`;
			}

			const endpoint = url.includes("/documentation/docc")
				? AppleAPIClient.API_ENDPOINTS.docc
				: AppleAPIClient.API_ENDPOINTS.default;

			return `${endpoint}${path}.json`;
		} catch (error) {
			throw new Error(`Invalid URL: ${error instanceof Error ? error.message : "Unknown error"}`);
		}
	}

	private validateDocumentData(data: unknown): void {
		if (!data || typeof data !== "object") {
			throw new Error("Invalid response: not an object");
		}
		const record = data as Record<string, unknown>;
		if (!record.primaryContentSections) {
			throw new Error("PERMANENT_ERROR:NO_PRIMARY_CONTENT:Missing primaryContentSections field");
		}
		if (!record.metadata) {
			throw new Error("Invalid response: missing metadata field");
		}

		// Content quality validation - check for substantial content
		const sections = record.primaryContentSections;
		if (!Array.isArray(sections) || sections.length === 0) {
			throw new Error("PERMANENT_ERROR:NO_SUBSTANTIAL_CONTENT:Empty sections");
		}

		const hasSubstantialContent = sections.some((section) => {
			const kind = section.kind || section.type;

			// Exclude mentions-only sections
			if (kind === "mentions") return false;

			// Check content sections for non-link content
			if (kind === "content" && section.content) {
				return section.content.some(
					(item: unknown) => (item as Record<string, unknown>).type !== "links",
				);
			}

			// Other section types are considered substantial
			return true;
		});

		if (!hasSubstantialContent) {
			throw new Error(
				"PERMANENT_ERROR:NO_SUBSTANTIAL_CONTENT:Only contains mentions or link lists",
			);
		}
	}
}

export { AppleAPIClient };
