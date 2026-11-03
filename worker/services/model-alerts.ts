import { sendTelegram } from "../shared/telegram.js";
import type { Env } from "../shared/types.js";
import type { WaitUntilContext } from "./d1-utils.js";

export type ModelAlertReporter = (key: string, message: string) => void;

const COOLDOWN_MS = 5 * 60 * 1000;
// ponytail: best-effort per-isolate dedup; shared coordination only if duplicate alerts become a problem.
const sentAlerts = new Map<string, number>();

export function createModelAlertReporter(env: Env, ctx: WaitUntilContext): ModelAlertReporter {
	return (key, message) => {
		let safeMessage = message;
		for (const secret of [env.TYPESAFE_API_KEY, env.DEEPINFRA_API_KEY]) {
			if (secret) safeMessage = safeMessage.replaceAll(secret, "[REDACTED]");
		}
		console.warn(`[MCP][MODEL] ${safeMessage}`);
		const url = env.TELEGRAM_ALERT_BOT_URL;
		if (!url) return;

		const now = Date.now();
		const alertKey = `${url}:${key}`;
		if (now - (sentAlerts.get(alertKey) ?? -Infinity) < COOLDOWN_MS) return;
		for (const [oldKey, timestamp] of sentAlerts) {
			if (now - timestamp >= COOLDOWN_MS) sentAlerts.delete(oldKey);
		}
		if (sentAlerts.size >= 128) sentAlerts.delete(sentAlerts.keys().next().value!);
		sentAlerts.set(alertKey, now);

		ctx.waitUntil(
			sendTelegram(url, `[MCP][MODEL] ${safeMessage}`).then((delivered) => {
				if (!delivered && sentAlerts.get(alertKey) === now) sentAlerts.delete(alertKey);
			}),
		);
	};
}
