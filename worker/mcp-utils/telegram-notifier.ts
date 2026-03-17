import { sendTelegram } from "../shared/telegram.js";

let url: string | undefined;

export function configureTelegram(u?: string): void {
	url = u;
}

export async function notifyTelegram(message: string): Promise<void> {
	await sendTelegram(url, `[MCP] ${message}`);
}
