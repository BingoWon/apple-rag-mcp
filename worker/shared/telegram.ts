const MAX_LENGTH = 4000;

export async function sendTelegram(url: string | undefined, message: string): Promise<void> {
	if (!url) return;
	try {
		const text =
			message.length > MAX_LENGTH
				? `${message.slice(0, MAX_LENGTH - 20)}\n\n... [truncated]`
				: message;
		const res = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ text }),
			signal: AbortSignal.timeout(5000),
		});
		if (!res.ok) console.error(`[Telegram] HTTP ${res.status}`);
	} catch (e) {
		console.error("[Telegram] Send failed:", e instanceof Error ? e.message : String(e));
	}
}
