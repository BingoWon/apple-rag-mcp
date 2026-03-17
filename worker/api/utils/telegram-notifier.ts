type TelegramChannel = "default" | "alerts";

const telegramUrls: Partial<Record<TelegramChannel, string>> = {};

function configureTelegram(config: Partial<Record<TelegramChannel, string>>): void {
	if (config.default) {
		telegramUrls.default = config.default;
	} else {
		delete telegramUrls.default;
	}

	if (config.alerts) {
		telegramUrls.alerts = config.alerts;
	} else {
		delete telegramUrls.alerts;
	}
}

async function notifyTelegram(
	message: string,
	channel: TelegramChannel = "default",
): Promise<void> {
	const targetUrl = telegramUrls[channel];

	if (!targetUrl) {
		console.warn(`[Telegram] Missing webhook for channel "${channel}", message dropped`);
		return;
	}

	try {
		const prefixedMessage = `[API] ${message}`;
		const response = await fetch(targetUrl, {
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

		const result = (await response.json()) as any;
		if (!result.ok) {
			console.error(`[Telegram] API error:`, result);
			return;
		}

		console.log(`[Telegram] Message sent successfully (${channel})`);
	} catch (error) {
		console.error(
			`[Telegram] Send failed (${channel}):`,
			error instanceof Error ? error.message : String(error),
		);
	}
}

export type { TelegramChannel };
export { configureTelegram, notifyTelegram };
