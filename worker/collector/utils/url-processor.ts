import { isValidAppleUrl, normalizeAppleUrl } from "../../shared/url-utils.js";
import type { AppleAPIResponse } from "../types/index.js";

const BASE_URL = "https://developer.apple.com";

class UrlProcessor {
	extractAllUrls(docData: AppleAPIResponse): string[] {
		if (!docData.references) return [];

		const rawUrls = Object.values(docData.references)
			.filter((ref) => ref?.url)
			.map((ref) => (ref.url!.startsWith("http") ? ref.url! : `${BASE_URL}${ref.url}`))
			.filter(
				(url) =>
					url.startsWith("https://developer.apple.com/documentation") ||
					url.startsWith("https://developer.apple.com/design"),
			);

		return [...new Set(rawUrls.filter(isValidAppleUrl).map(normalizeAppleUrl))];
	}
}

export { UrlProcessor };
