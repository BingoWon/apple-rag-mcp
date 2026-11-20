const APPLE_DEVELOPER = "https://developer.apple.com";

export function normalizeAppleUrl(input: string): string | null {
	if (!input || input.length > 2048 || /[\\\s\uFEFF]|%ef%bb%bf/i.test(input)) return null;
	try {
		const url = new URL(input, APPLE_DEVELOPER);
		const path = url.pathname.toLowerCase().replace(/\/+$/, "");
		if (
			url.origin !== APPLE_DEVELOPER ||
			url.username ||
			url.password ||
			!/^\/(?:documentation|design)(?:\/|$)/.test(path) ||
			/https?:\/|developer\.apple\.com|\/documentation\/.*\/documentation\//.test(path)
		)
			return null;
		const canonical = APPLE_DEVELOPER + path;
		return canonical.length <= 2048 ? canonical : null;
	} catch {
		return null;
	}
}
