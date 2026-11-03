import { z } from "zod";
import { AppleAPIClient } from "../collector/AppleAPIClient.js";
import { ContentProcessor } from "../collector/ContentProcessor.js";
import type { DatabaseService } from "../mcp-types/index.js";
import { logger } from "../mcp-utils/logger.js";
import { readText } from "../shared/read-text.js";
import type { ToolOutcome } from "../shared/tool-outcomes.js";
import type { Env } from "../shared/types.js";
import {
	assertPublicHost,
	canCacheUrl,
	isAppleUrl,
	publicUrl,
	UnsafeUrlError,
} from "../shared/web-url.js";

export interface StoredWebPage {
	url: string;
	title: string | null;
	content: string;
	source: "apple" | "third_party";
	provider: "index" | "apple_json" | "apple_http" | "firecrawl";
	status: number;
}

export interface ReadPage extends StoredWebPage {
	pageId: string | null;
	cacheHit: boolean;
}

export class PageReadError extends Error {
	constructor(
		readonly reason: string,
		message: string,
		readonly status = 502,
		readonly outcome: Extract<
			ToolOutcome,
			"invalid" | "limited" | "failed" | "no_content"
		> = "failed",
		readonly url?: string,
		readonly provider?: string,
		readonly upstreamStatus?: number,
		readonly cacheHit = false,
	) {
		super(message);
	}
}

const firecrawlSchema = z.object({
	success: z.literal(true),
	data: z.object({
		markdown: z.string().max(200_000),
		metadata: z.object({
			title: z.string().optional(),
			statusCode: z.number().int(),
		}),
	}),
});

export class PageReader {
	constructor(
		private readonly database: DatabaseService,
		private readonly env: Pick<Env, "FIRECRAWL_API_KEY" | "FIRECRAWL_DAILY_LIMIT">,
	) {}

	async getPage(input: string, signal: AbortSignal): Promise<ReadPage> {
		let url: string;
		try {
			url = publicUrl(input);
		} catch {
			throw new PageReadError(
				"INVALID_URL",
				"Use a public HTTP(S) URL without credentials or a custom port.",
				400,
				"invalid",
			);
		}
		signal.throwIfAborted();
		const stored = await this.database.getPageByUrl(url);
		signal.throwIfAborted();
		if (stored?.content.trim())
			return {
				...stored,
				source: isAppleUrl(stored.url) ? "apple" : "third_party",
				provider: "index",
				status: 200,
				pageId: stored.id,
				cacheHit: false,
			};
		const cached = canCacheUrl(url)
			? await this.database.getCachedPage(url).catch(() => {
					logger.warn("Could not read the webpage cache.");
					return null;
				})
			: null;
		signal.throwIfAborted();
		if (cached) {
			this.checkTarget(cached.status, cached.url, cached.provider, true);
			return { ...cached, pageId: null, cacheHit: true };
		}
		const deadline = AbortSignal.any([signal, AbortSignal.timeout(30_000)]);
		let page: StoredWebPage;
		try {
			page = isAppleUrl(url)
				? await this.readApple(url, deadline)
				: await this.readWeb(url, deadline);
		} catch (error) {
			signal.throwIfAborted();
			if (error instanceof PageReadError && error.reason === "PAGE_NOT_FOUND") {
				await this.cache(url, {
					url: error.url ?? url,
					title: null,
					content: "",
					source: isAppleUrl(error.url ?? url) ? "apple" : "third_party",
					provider: error.provider === "firecrawl" ? "firecrawl" : "apple_http",
					status: error.upstreamStatus ?? 404,
				});
			}
			if (deadline.aborted)
				throw new PageReadError(
					"FETCH_TIMEOUT",
					"The webpage could not be read within 30 seconds.",
					504,
				);
			if (error instanceof PageReadError) throw error;
			throw new PageReadError(
				"NETWORK_ERROR",
				"The webpage could not be retrieved. Please retry.",
				502,
				"failed",
				url,
			);
		}
		signal.throwIfAborted();
		await this.cache(url, page);
		if (page.provider === "apple_json" && new URL(page.url).hostname === "developer.apple.com") {
			await this.database
				.enqueuePage(page.url)
				.catch(() => logger.warn("Could not schedule the official page for indexing."));
		}
		return { ...page, pageId: null, cacheHit: false };
	}

	private async cache(requestedUrl: string, page: StoredWebPage): Promise<void> {
		if (canCacheUrl(requestedUrl) && canCacheUrl(page.url)) {
			await this.database
				.cachePage(requestedUrl, page)
				.catch(() => logger.warn("Could not persist the webpage cache."));
		}
	}

	private async readApple(url: string, signal: AbortSignal): Promise<StoredWebPage> {
		let finalUrl = url;
		for (let hop = 0; ; hop++) {
			const response = await fetch(finalUrl, { redirect: "manual", signal });
			await response.body?.cancel();
			if ([301, 302, 303, 307, 308].includes(response.status)) {
				const location = response.headers.get("location");
				if (!location || hop >= 5)
					throw new PageReadError(
						"REDIRECT_FAILED",
						"The webpage has an invalid or excessive redirect chain.",
					);
				let target: string;
				try {
					target = publicUrl(new URL(location, finalUrl).toString());
				} catch {
					throw new PageReadError(
						"BLOCKED_REDIRECT",
						"The webpage redirects to an unsafe address.",
						400,
						"invalid",
					);
				}
				if (!isAppleUrl(target)) return this.readWeb(target, signal);
				finalUrl = target;
				continue;
			}
			if (response.status === 404 || response.status === 410)
				this.checkTarget(response.status, finalUrl, "apple_http");
			if (!response.ok) return this.readWeb(finalUrl, signal);
			break;
		}
		if (finalUrl !== url) {
			const stored = await this.database.getPageByUrl(finalUrl);
			if (stored?.content.trim())
				return { ...stored, source: "apple", provider: "index", status: 200 };
		}
		if (
			new URL(finalUrl).hostname === "developer.apple.com" &&
			new URL(finalUrl).pathname.startsWith("/documentation/")
		) {
			const [raw] = await new AppleAPIClient().fetchDocuments([finalUrl], signal);
			signal.throwIfAborted();
			if (raw?.data) {
				const [processed] = await new ContentProcessor().processDocuments([raw]);
				if (processed?.data?.content.trim())
					return {
						url: finalUrl,
						title: processed.data.title,
						content: processed.data.content,
						source: "apple",
						provider: "apple_json",
						status: 200,
					};
			}
		}
		return this.readWeb(finalUrl, signal);
	}

	private async readWeb(url: string, signal: AbortSignal): Promise<StoredWebPage> {
		try {
			await assertPublicHost(url, signal);
		} catch (error) {
			signal.throwIfAborted();
			if (!(error instanceof UnsafeUrlError))
				throw new PageReadError(
					"DNS_LOOKUP_FAILED",
					"The public hostname could not be checked. Please retry.",
					502,
					"failed",
					url,
				);
			throw new PageReadError(
				"BLOCKED_URL",
				"The destination could not be verified as a public website.",
				400,
				"invalid",
			);
		}
		const limit = Number(this.env.FIRECRAWL_DAILY_LIMIT ?? 25);
		if (!Number.isInteger(limit) || limit < 0)
			throw new PageReadError(
				"PROVIDER_CONFIGURATION",
				"Webpage reading is temporarily unavailable.",
				503,
			);
		if (!(await this.database.reserveWebFetch(limit)))
			throw new PageReadError(
				"PROVIDER_BUDGET_EXCEEDED",
				"The daily webpage reading allowance has been reached. Try again tomorrow.",
				429,
				"limited",
				url,
				"firecrawl",
			);
		signal.throwIfAborted();
		const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
			method: "POST",
			redirect: "manual",
			signal,
			headers: {
				"Content-Type": "application/json",
				...(this.env.FIRECRAWL_API_KEY
					? { Authorization: `Bearer ${this.env.FIRECRAWL_API_KEY}` }
					: {}),
			},
			body: JSON.stringify({
				url,
				formats: ["markdown"],
				onlyMainContent: true,
				maxAge: 0,
				storeInCache: false,
				skipTlsVerification: false,
				timeout: 20_000,
			}),
		});
		if (!response.ok) {
			await response.body?.cancel();
			throw new PageReadError(
				response.status === 429 || response.status === 402
					? "PROVIDER_RATE_LIMITED"
					: "PROVIDER_FAILED",
				"The webpage reading provider is temporarily unavailable.",
				response.status === 429 || response.status === 402 ? 429 : 502,
				response.status === 429 || response.status === 402 ? "limited" : "failed",
				url,
				"firecrawl",
				response.status,
			);
		}
		let payload: unknown;
		try {
			payload = JSON.parse(await readText(response));
		} catch {
			signal.throwIfAborted();
			throw new PageReadError(
				"PROVIDER_INVALID_RESPONSE",
				"The webpage provider returned an invalid or oversized response.",
				502,
				"failed",
				url,
				"firecrawl",
			);
		}
		const result = firecrawlSchema.safeParse(payload);
		if (!result.success)
			throw new PageReadError(
				"PROVIDER_INVALID_RESPONSE",
				"The webpage provider returned an invalid or oversized document.",
				502,
				"failed",
				url,
				"firecrawl",
			);
		const { markdown, metadata } = result.data.data;
		this.checkTarget(metadata.statusCode, url, "firecrawl");
		if (
			!markdown.trim() ||
			/(?:#\s*(?:access denied|just a moment|verify you are human|the page you.re looking for can.t be found))/i.test(
				markdown,
			)
		)
			throw new PageReadError(
				"NO_USABLE_CONTENT",
				"The webpage did not provide readable content.",
				422,
				"no_content",
				url,
				"firecrawl",
				metadata.statusCode,
			);
		return {
			url,
			title: metadata.title ?? null,
			content: markdown,
			source: isAppleUrl(url) ? "apple" : "third_party",
			provider: "firecrawl",
			status: 200,
		};
	}

	private checkTarget(status: number, url: string, provider: string, cacheHit = false): void {
		if (status >= 200 && status < 300) return;
		const missing = status === 404 || status === 410;
		throw new PageReadError(
			missing
				? "PAGE_NOT_FOUND"
				: status === 429
					? "UPSTREAM_RATE_LIMITED"
					: status === 401 || status === 403
						? "ACCESS_BLOCKED"
						: "UPSTREAM_FAILED",
			missing
				? "The target website reports that this page does not exist."
				: "The target website did not allow the page to be read.",
			missing ? 404 : status === 429 ? 429 : 502,
			missing ? "no_content" : status === 429 ? "limited" : "failed",
			url,
			provider,
			status,
			cacheHit,
		);
	}
}
