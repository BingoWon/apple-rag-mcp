import { sendTelegram } from "../../shared/telegram.js";

let statsUrl: string | undefined;
let alertUrl: string | undefined;

export function configureTelegram(stats?: string, alert?: string): void {
	statsUrl = stats;
	alertUrl = alert;
}

export async function notifyStats(message: string): Promise<void> {
	await sendTelegram(statsUrl, `[COLLECTOR] ${message}`);
}

export async function notifyAlert(message: string): Promise<void> {
	await sendTelegram(alertUrl, `[COLLECTOR] ${message}`);
}
