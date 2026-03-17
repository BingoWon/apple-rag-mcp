/**
 * Telegram Notifier with Dual Bot Support
 * - Stats Bot: Collector completion and content updates
 * - Alert Bot: Error notifications
 */

const SAFE_MESSAGE_LENGTH = 4000;
const PREFIX = "[COLLECTOR]";
const TRUNCATION_SUFFIX = "\n\n⚠️ [Message truncated]";

let statsUrl: string | undefined;
let alertUrl: string | undefined;

function configureTelegram(stats?: string, alert?: string): void {
	statsUrl = stats;
	alertUrl = alert;
}

function truncateMessage(message: string, maxLength: number): string {
	if (message.length <= maxLength) return message;

	const availableLength = maxLength - TRUNCATION_SUFFIX.length;
	const firstPart = message.slice(0, Math.floor(availableLength * 0.8));
	const lastPart = message.slice(-(availableLength - firstPart.length));

	return `${firstPart}${TRUNCATION_SUFFIX}\n\n...${lastPart}`;
}

async function send(url: string | undefined, message: string): Promise<void> {
	if (!url) return;

	try {
		const finalMessage = truncateMessage(`${PREFIX} ${message}`, SAFE_MESSAGE_LENGTH);

		const res = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ text: finalMessage }),
			signal: AbortSignal.timeout(5000),
		});

		if (!res.ok) {
			console.error(`[Telegram] HTTP ${res.status}: ${await res.text()}`);
		}
	} catch (error) {
		console.error(
			`[Telegram] Send failed: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

async function notifyStats(message: string): Promise<void> {
	await send(statsUrl, message);
}

async function notifyAlert(message: string): Promise<void> {
	await send(alertUrl, message);
}

export { configureTelegram, notifyAlert, notifyStats };
