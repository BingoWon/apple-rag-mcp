export function isValidAppleUrl(url: string): boolean {
	return ![
		url.split("https://").length > 2 || url.split("http://").length > 2,
		url.includes("%ef%bb%bf") || url.includes("\ufeff"),
		url.split("/documentation/").length > 2,
		url.includes("https:/") && !url.startsWith("https://"),
		url.length > 200,
		url.split("developer.apple.com").length > 2,
	].some(Boolean);
}

export function normalizeAppleUrl(url: string): string {
	try {
		const parsed = new URL(url);
		const path = parsed.pathname === "/" ? "/" : parsed.pathname.replace(/\/+$/, "");
		return `${parsed.protocol.toLowerCase()}//${parsed.hostname.toLowerCase()}${path}`;
	} catch {
		return url;
	}
}
