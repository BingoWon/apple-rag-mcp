import { SITE_ORIGIN } from "../shared/site.js";

export const INDEXNOW_KEY = "a7e9f1b4c2d84e6091f3b5c7d9e1a305";
export const INDEXNOW_KEY_PATH = `/${INDEXNOW_KEY}.txt`;
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

export async function submitIndexNow(urls: readonly string[]): Promise<boolean> {
	const cleaned = Array.from(
		new Set(
			urls.map((u) => u.trim()).filter((u) => u.startsWith(`${SITE_ORIGIN}/`) || u === SITE_ORIGIN),
		),
	).slice(0, 100);
	if (cleaned.length === 0) return false;

	try {
		const response = await fetch(INDEXNOW_ENDPOINT, {
			method: "POST",
			headers: { "Content-Type": "application/json; charset=utf-8" },
			body: JSON.stringify({
				host: new URL(SITE_ORIGIN).hostname,
				key: INDEXNOW_KEY,
				keyLocation: `${SITE_ORIGIN}${INDEXNOW_KEY_PATH}`,
				urlList: cleaned,
			}),
			signal: AbortSignal.timeout(8_000),
		});
		return response.ok || response.status === 202;
	} catch (error) {
		console.warn(
			`IndexNow submission skipped: ${error instanceof Error ? error.message : String(error)}`,
		);
		return false;
	}
}
