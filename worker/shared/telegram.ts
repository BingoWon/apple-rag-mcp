const MAX_LENGTH = 4000;

export async function sendTelegram(url: string | undefined, message: string): Promise<boolean> {
	if (!url) return false;
	const text =
		message.length > MAX_LENGTH
			? `${message.slice(0, MAX_LENGTH - 20)}\n\n... [truncated]`
			: message;
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const res = await fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ text }),
				signal: AbortSignal.timeout(5000),
			});
			const body = res.headers.get("content-type")?.includes("application/json")
				? ((await res.json()) as {
						ok?: boolean;
						description?: string;
						parameters?: { retry_after?: number };
					})
				: undefined;
			if (res.ok && body?.ok !== false) return true;
			console.error(`[Telegram] HTTP ${res.status}: ${body?.description ?? "Send rejected"}`);
			if (res.status !== 429 && res.status < 500) return false;
			const retryAfter = Number(
				res.headers.get("retry-after") ?? body?.parameters?.retry_after ?? 1,
			);
			if (attempt === 1 || !Number.isFinite(retryAfter) || retryAfter > 5) return false;
			await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter, 0) * 1000));
		} catch (e) {
			const reason = (e instanceof Error ? e.message : String(e)).replaceAll(url, "[REDACTED_URL]");
			console.error("[Telegram] Send failed:", reason);
		}
	}
	return false;
}
