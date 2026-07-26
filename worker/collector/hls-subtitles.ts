const HLS_FETCH_TIMEOUT_MS = 20_000;
const HLS_TOTAL_TIMEOUT_MS = 120_000;
const HLS_SEGMENT_CONCURRENCY = 3;
const HLS_MAX_SEGMENTS = 2_000;

interface HlsSubtitleTrack {
	readonly uri: string;
	readonly language: string;
	readonly name: string;
	readonly isDefault: boolean;
}

interface FetchHlsSubtitleOptions {
	readonly fetcher?: typeof fetch;
	readonly timeoutMs?: number;
	readonly totalTimeoutMs?: number;
	readonly concurrency?: number;
}

export class HlsSubtitleUnavailableError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "HlsSubtitleUnavailableError";
	}
}

export function isSupportedVideoPageUrl(value: string): boolean {
	try {
		const url = new URL(value, "https://developer.apple.com");
		const path = url.pathname.replace(/\/+$/, "");
		return /^\/videos\/play\/[^/]+\/[^/]+$/.test(path);
	} catch {
		return false;
	}
}

export function extractHtmlTranscriptText(html: string): string | null {
	const transcriptMatch = html.match(/<section id="transcript-content">([\s\S]*?)<\/section>/i);
	if (!transcriptMatch) return null;

	const segments = [...transcriptMatch[1]!.matchAll(/data-start="[0-9.]+"[^>]*>([^<]*)/gi)]
		.map((match) => decodeHtmlEntities(match[1]!).trim())
		.filter(Boolean);

	return segments.length > 0 ? segments.join(" ") : null;
}

export function extractHlsSourceUrl(html: string): string | null {
	const videoTag =
		html.match(/<video[^>]+id="video"[^>]*>/i)?.[0] ?? html.match(/<video[^>]*>/i)?.[0];
	const videoSource = videoTag?.match(/\ssrc="([^"]+)"/i)?.[1];
	if (videoSource?.includes(".m3u8")) {
		return decodeHtmlEntities(videoSource);
	}

	const metaSource = html.match(
		/<meta[^>]+property="og:video(?:_secure_url)?"[^>]+content="([^"]+)"/i,
	)?.[1];
	return metaSource?.includes(".m3u8") ? decodeHtmlEntities(metaSource) : null;
}

export function selectSubtitlePlaylistUrl(
	masterPlaylist: string,
	masterPlaylistUrl: string,
): string | null {
	const tracks = masterPlaylist
		.split(/\r?\n/)
		.filter((line) => line.startsWith("#EXT-X-MEDIA:"))
		.map(parseSubtitleTrack)
		.filter((track): track is HlsSubtitleTrack => track !== null);

	if (tracks.length === 0) return null;

	const selected =
		tracks.find((track) => track.language.toLowerCase() === "en" && track.isDefault) ??
		tracks.find((track) => track.language.toLowerCase() === "en") ??
		tracks.find((track) => track.name.toLowerCase() === "english") ??
		tracks.find((track) => track.isDefault) ??
		tracks[0]!;

	return new URL(selected.uri, masterPlaylistUrl).href;
}

export function extractMediaSegmentUrls(playlist: string, playlistUrl: string): string[] {
	return playlist
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !line.startsWith("#"))
		.map((line) => new URL(line, playlistUrl).href);
}

export function extractWebVttCues(webVtt: string): string[] {
	const normalized = webVtt.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
	const blocks = normalized.split(/\n{2,}/);
	const cues: string[] = [];

	for (const block of blocks) {
		const lines = block
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean);

		if (lines.length === 0) continue;
		if (/^(WEBVTT|NOTE|STYLE|REGION)\b/i.test(lines[0]!)) continue;

		const timingIndex = lines.findIndex((line) => line.includes("-->"));
		if (timingIndex === -1) continue;

		const text = lines
			.slice(timingIndex + 1)
			.join(" ")
			.replace(/<[^>]+>/g, "")
			.replace(/\s+/g, " ")
			.trim();

		if (text) cues.push(decodeHtmlEntities(text));
	}

	return cues;
}

export async function fetchHlsSubtitleText(
	masterPlaylistUrl: string,
	options: FetchHlsSubtitleOptions = {},
): Promise<string> {
	const fetcher = options.fetcher ?? fetch;
	const timeoutMs = options.timeoutMs ?? HLS_FETCH_TIMEOUT_MS;
	const totalTimeoutMs = options.totalTimeoutMs ?? HLS_TOTAL_TIMEOUT_MS;
	const concurrency = Math.max(1, options.concurrency ?? HLS_SEGMENT_CONCURRENCY);
	const deadline = Date.now() + totalTimeoutMs;
	const fetchBeforeDeadline = (url: string) => {
		const remainingMs = deadline - Date.now();
		if (remainingMs <= 0) {
			throw new Error(`HLS subtitle processing timed out after ${totalTimeoutMs}ms`);
		}
		return fetchText(fetcher, url, Math.min(timeoutMs, remainingMs));
	};

	const masterPlaylist = await fetchBeforeDeadline(masterPlaylistUrl);
	const subtitlePlaylistUrl = selectSubtitlePlaylistUrl(masterPlaylist, masterPlaylistUrl);
	if (!subtitlePlaylistUrl) {
		throw new HlsSubtitleUnavailableError("HLS playlist does not contain a subtitle track");
	}

	const subtitlePlaylist = await fetchBeforeDeadline(subtitlePlaylistUrl);
	if (/^\s*WEBVTT\b/i.test(subtitlePlaylist)) {
		const directCues = extractWebVttCues(subtitlePlaylist);
		if (directCues.length === 0) {
			throw new HlsSubtitleUnavailableError("HLS subtitle file contains no cues");
		}
		return directCues.join(" ");
	}

	const segmentUrls = extractMediaSegmentUrls(subtitlePlaylist, subtitlePlaylistUrl);
	if (segmentUrls.length === 0) {
		throw new HlsSubtitleUnavailableError("HLS subtitle playlist contains no media segments");
	}
	if (segmentUrls.length > HLS_MAX_SEGMENTS) {
		throw new Error(
			`HLS subtitle playlist exceeds ${HLS_MAX_SEGMENTS} segments: ${segmentUrls.length}`,
		);
	}

	const segmentTexts = await mapWithConcurrency(segmentUrls, concurrency, fetchBeforeDeadline);
	const cues = segmentTexts.flatMap(extractWebVttCues);
	const deduplicated = cues.filter((cue, index) => index === 0 || cue !== cues[index - 1]);

	if (deduplicated.length === 0) {
		throw new HlsSubtitleUnavailableError("HLS subtitle segments contain no cues");
	}

	return deduplicated.join(" ");
}

function parseSubtitleTrack(line: string): HlsSubtitleTrack | null {
	if (readHlsAttribute(line, "TYPE")?.toUpperCase() !== "SUBTITLES") return null;

	const uri = readHlsAttribute(line, "URI");
	if (!uri) return null;

	return {
		uri,
		language: readHlsAttribute(line, "LANGUAGE") ?? "",
		name: readHlsAttribute(line, "NAME") ?? "",
		isDefault: readHlsAttribute(line, "DEFAULT")?.toUpperCase() === "YES",
	};
}

function readHlsAttribute(line: string, name: string): string | null {
	const match = line.match(new RegExp(`(?:^|[:,])${name}=("(?:[^"]|"")*"|[^,]*)`, "i"));
	if (!match?.[1]) return null;

	const raw = match[1].trim();
	return raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1).replace(/""/g, '"') : raw;
}

async function fetchText(fetcher: typeof fetch, url: string, timeoutMs: number): Promise<string> {
	const response = await fetcher(url, {
		headers: {
			Accept: "application/vnd.apple.mpegurl, text/vtt, text/plain;q=0.9, */*;q=0.8",
			"User-Agent":
				"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/139 Safari/537.36",
		},
		signal: AbortSignal.timeout(timeoutMs),
	});

	if (!response.ok) {
		throw new Error(`HLS subtitle request failed: HTTP ${response.status} ${url}`);
	}

	return await response.text();
}

async function mapWithConcurrency<T, R>(
	items: readonly T[],
	concurrency: number,
	operation: (item: T) => Promise<R>,
): Promise<R[]> {
	const results = new Array<R>(items.length);
	let nextIndex = 0;

	async function worker(): Promise<void> {
		while (nextIndex < items.length) {
			const index = nextIndex++;
			results[index] = await operation(items[index]!);
		}
	}

	await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
	return results;
}

function decodeHtmlEntities(value: string): string {
	return value.replace(
		/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,
		(match, entity: string) => {
			const normalized = entity.toLowerCase();
			if (normalized === "amp") return "&";
			if (normalized === "lt") return "<";
			if (normalized === "gt") return ">";
			if (normalized === "quot") return '"';
			if (normalized === "apos") return "'";
			if (normalized === "nbsp") return " ";
			if (normalized.startsWith("#x")) {
				return String.fromCodePoint(Number.parseInt(normalized.slice(2), 16));
			}
			if (normalized.startsWith("#")) {
				return String.fromCodePoint(Number.parseInt(normalized.slice(1), 10));
			}
			return match;
		},
	);
}
