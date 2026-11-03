import type { AccountStatus, FetchOutput, SearchOutput } from "../../shared/contracts.js";
import type { ReadPage } from "./page-reader.js";
import type { RAGResult, SearchResult } from "./types.js";

function completeDocument(result: SearchResult): boolean {
	const indices = new Set(result.mergedChunkIndices ?? [result.chunk_index]);
	return (
		indices.size === result.total_chunks &&
		[...indices].every((i) => i >= 0 && i < result.total_chunks)
	);
}

export function searchOutput(result: RAGResult, account: AccountStatus): SearchOutput {
	return {
		account,
		ok: true,
		outcome: result.degradations.length
			? "degraded"
			: result.results.length
				? "success"
				: "no_content",
		query: result.query,
		results: result.results.map((item) => ({
			url: item.url,
			title: item.title,
			content: item.content,
			source: "apple",
			provider: "index",
			complete: completeDocument(item),
			total_chunks: item.total_chunks,
			chunk_indices: item.mergedChunkIndices ?? [item.chunk_index],
		})),
		additional_urls: result.additionalUrls.map((item) => ({
			url: item.url,
			title: item.title,
			character_count: item.characterCount,
		})),
		degradations: result.degradations,
	};
}

export function fetchOutput(
	requestedUrl: string,
	page: ReadPage,
	account: AccountStatus,
): FetchOutput {
	return {
		account,
		ok: true,
		outcome: page.provider === "index" ? "success" : "degraded",
		requested_url: requestedUrl,
		url: page.url,
		title: page.title,
		content: page.content,
		source: page.source,
		provider: page.provider,
		upstream_status: page.provider === "index" ? null : page.status,
		cache_hit: page.cacheHit,
	};
}
