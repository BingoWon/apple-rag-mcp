import { sendTelegram } from "../../shared/telegram.js";

type TelegramChannel = "default" | "alerts";

const urls: Partial<Record<TelegramChannel, string>> = {};

export function configureTelegram(config: Partial<Record<TelegramChannel, string>>): void {
	for (const key of ["default", "alerts"] as const) {
		if (config[key]) urls[key] = config[key];
		else delete urls[key];
	}
}

export async function notifyTelegram(
	message: string,
	channel: TelegramChannel = "default",
): Promise<void> {
	await sendTelegram(urls[channel], `[API] ${message}`);
}
