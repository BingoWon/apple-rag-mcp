const KEY = "apple-rag-auth-return";
export function safeAuthReturn(value: string | null | undefined): string {
	if (!value?.startsWith("/")) return "/overview";
	try {
		const url = new URL(value, "https://apple-rag.com");
		return url.origin === "https://apple-rag.com" ? url.pathname + url.search : "/overview";
	} catch {
		return "/overview";
	}
}
export function rememberAuthReturn(value: string): void {
	sessionStorage.setItem(
		KEY,
		JSON.stringify({ path: safeAuthReturn(value), expires: Date.now() + 600000 }),
	);
}
export function authReturnPath(): string {
	try {
		const stored = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
		return stored?.expires > Date.now() ? safeAuthReturn(stored.path) : "/overview";
	} catch {
		return "/overview";
	}
}
export function clearAuthReturn(): void {
	sessionStorage.removeItem(KEY);
}
