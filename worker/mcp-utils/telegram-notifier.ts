interface TelegramApiResponse {
	ok: boolean;
	result?: unknown;
	error_code?: number;
	description?: string;
}

let telegramUrl: string | undefined;

function configureTelegram(url?: string): void {
	telegramUrl = url;
}

async function notifyTelegram(message: string): Promise<void> {
	if (!telegramUrl) return;

	try {
		const prefixedMessage = `[MCP] ${message}`;
		const response = await fetch(telegramUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ text: prefixedMessage }),
			signal: AbortSignal.timeout(5000),
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`[Telegram] HTTP ${response.status}: ${errorText}`);
			return;
		}

		const result = (await response.json()) as TelegramApiResponse;
		if (!result.ok) {
			console.error(`[Telegram] API error:`, result);
			return;
		}

		console.log(`[Telegram] Message sent successfully`);
	} catch (error) {
		console.error(
			`[Telegram] Send failed:`,
			error instanceof Error ? error.message : String(error),
		);
	}
}

export { configureTelegram, notifyTelegram };
