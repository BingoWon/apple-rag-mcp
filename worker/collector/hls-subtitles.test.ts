import assert from "node:assert/strict";
import test from "node:test";
import {
	extractHlsSourceUrl,
	extractHtmlTranscriptText,
	extractMediaSegmentUrls,
	extractWebVttCues,
	fetchHlsSubtitleText,
	isSupportedVideoPageUrl,
	selectSubtitlePlaylistUrl,
} from "./hls-subtitles.ts";

test("validates Apple video page paths", () => {
	assert.equal(isSupportedVideoPageUrl("/videos/play/wwdc2026/259"), true);
	assert.equal(isSupportedVideoPageUrl("/videos/play/meet-with-apple/277/"), true);
	assert.equal(isSupportedVideoPageUrl("/videos/play//"), false);
	assert.equal(isSupportedVideoPageUrl("/videos/play/wwdc2026"), false);
	assert.equal(isSupportedVideoPageUrl("/videos/play/wwdc2026/259/extra"), false);
});

test("extracts HTML transcript text", () => {
	const html = `
		<section id="transcript-content">
			<p><span class="sentence"><span data-start="1.0">Hello &amp; welcome. </span></span></p>
			<p><span class="sentence"><span data-start="2.0">Build something great.</span></span></p>
		</section>
	`;

	assert.equal(extractHtmlTranscriptText(html), "Hello & welcome. Build something great.");
	assert.equal(extractHtmlTranscriptText('<section id="transcript-content"></section>'), null);
});

test("extracts HLS source from video and Open Graph metadata", () => {
	assert.equal(
		extractHlsSourceUrl('<video id="video" src="https://cdn.example/master.m3u8"></video>'),
		"https://cdn.example/master.m3u8",
	);
	assert.equal(
		extractHlsSourceUrl(
			'<meta property="og:video" content="https://cdn.example/master.m3u8?x=1&amp;y=2">',
		),
		"https://cdn.example/master.m3u8?x=1&y=2",
	);
});

test("selects the default English subtitle track", () => {
	const master = [
		"#EXTM3U",
		'#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="Español",LANGUAGE="es",URI="es/index.m3u8"',
		'#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",DEFAULT=YES,LANGUAGE="en",URI="en/index.m3u8"',
	].join("\n");

	assert.equal(
		selectSubtitlePlaylistUrl(master, "https://cdn.example/video/master.m3u8"),
		"https://cdn.example/video/en/index.m3u8",
	);
});

test("resolves subtitle media segment URLs", () => {
	const playlist = [
		"#EXTM3U",
		"#EXTINF:10,",
		"segment-0.webvtt",
		"#EXTINF:10,",
		"../shared/segment-1.webvtt",
	].join("\n");

	assert.deepEqual(extractMediaSegmentUrls(playlist, "https://cdn.example/video/en/index.m3u8"), [
		"https://cdn.example/video/en/segment-0.webvtt",
		"https://cdn.example/video/shared/segment-1.webvtt",
	]);
});

test("extracts readable text from WebVTT cues", () => {
	const webVtt = `WEBVTT

1
00:00:00.000 --> 00:00:02.000
<v Speaker>Hello &amp; welcome.</v>

2
00:00:02.000 --> 00:00:04.000 align:start
Build <c.highlight>something</c> great.

NOTE this block is ignored
Metadata
`;

	assert.deepEqual(extractWebVttCues(webVtt), ["Hello & welcome.", "Build something great."]);
});

test("downloads and combines segmented HLS subtitles", async () => {
	const responses = new Map([
		[
			"https://cdn.example/master.m3u8",
			[
				"#EXTM3U",
				'#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",LANGUAGE="en",URI="subs/index.m3u8"',
			].join("\n"),
		],
		[
			"https://cdn.example/subs/index.m3u8",
			["#EXTM3U", "#EXTINF:10,", "0.webvtt", "#EXTINF:10,", "1.webvtt"].join("\n"),
		],
		["https://cdn.example/subs/0.webvtt", "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nFirst cue.\n"],
		["https://cdn.example/subs/1.webvtt", "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nSecond cue.\n"],
	]);
	const fetcher = async (input: URL | RequestInfo) => {
		const url = String(input);
		const body = responses.get(url);
		return body === undefined ? new Response("Not found", { status: 404 }) : new Response(body);
	};

	assert.equal(
		await fetchHlsSubtitleText("https://cdn.example/master.m3u8", {
			fetcher: fetcher as typeof fetch,
			timeoutMs: 1_000,
			concurrency: 2,
		}),
		"First cue. Second cue.",
	);
});
