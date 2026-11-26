const STORAGE_KEY = "apple_rag_signup_source";
const COOKIE_NAME = "apple_rag_ref";
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export function sanitizeSignupSource(raw: string | null | undefined): string | undefined {
	if (!raw) return undefined;
	const cleaned = raw
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9._:/-]+/g, "_")
		.replace(/^_+|_+$/g, "")
		.slice(0, 64);
	return cleaned || undefined;
}

function readCookieSource(): string | undefined {
	if (typeof document === "undefined") return undefined;
	const match = document.cookie.match(/(?:^|;\s*)apple_rag_ref=([^;]+)/);
	if (!match?.[1]) return undefined;
	try {
		return sanitizeSignupSource(decodeURIComponent(match[1]));
	} catch {
		return undefined;
	}
}

function writeSource(source: string): void {
	try {
		localStorage.setItem(STORAGE_KEY, source);
	} catch {}
	if (typeof document !== "undefined") {
		const secure =
			typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
		// biome-ignore lint/suspicious/noDocumentCookie: first-party attribution cookie read by server-side OAuth callback
		document.cookie = `${COOKIE_NAME}=${encodeURIComponent(source)}; Max-Age=${MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
	}
}

export function captureSignupAttribution(search: string): string | undefined {
	if (typeof window === "undefined") return undefined;
	const params = new URLSearchParams(search);
	const explicit = sanitizeSignupSource(
		params.get("ref") || params.get("utm_source") || params.get("source"),
	);
	if (explicit) {
		writeSource(explicit);
		return explicit;
	}

	const existing = getSignupSource();
	if (existing) return existing;

	if (typeof document !== "undefined" && document.referrer) {
		try {
			const refUrl = new URL(document.referrer);
			if (refUrl.hostname && refUrl.hostname !== window.location.hostname) {
				const host = sanitizeSignupSource(`ref:${refUrl.hostname.replace(/^www\./, "")}`);
				if (host) {
					writeSource(host);
					return host;
				}
			}
		} catch {}
	}

	return undefined;
}

export function getSignupSource(): string | undefined {
	if (typeof window === "undefined") return undefined;
	try {
		const stored = sanitizeSignupSource(localStorage.getItem(STORAGE_KEY));
		if (stored) return stored;
	} catch {}
	return readCookieSource();
}
