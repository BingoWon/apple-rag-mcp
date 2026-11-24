import { sendTelegram } from "../shared/telegram.js";
import type { Env } from "../shared/types.js";
import type { WaitUntilContext } from "./d1-utils.js";
import type { SearchTrace } from "./types.js";

export type ModelAlertReporter = (key: string, message: string, trace?: SearchTrace) => void;

// An isolate runs in one location. Keep only the observed colo across requests.
let workerTraceColo: string | undefined;
async function sampleWorkerColo(): Promise<string> {
	if (workerTraceColo) return workerTraceColo;
	try {
		const response = await fetch("https://mcp.apple-rag.com/cdn-cgi/trace", {
			signal: AbortSignal.timeout(1000),
			redirect: "manual",
		});
		if (response.ok) workerTraceColo = /^colo=([A-Z]{3})$/m.exec(await response.text())?.[1];
	} catch {
		// Send the alert even when Cloudflare trace is unavailable.
	}
	return workerTraceColo ?? "unavailable";
}

const COOLDOWN_MS = 5 * 60 * 1000;
// ponytail: best-effort per-isolate dedup; shared coordination only if duplicate alerts become a problem.
const sentAlerts = new Map<string, number>();

export function createModelAlertReporter(
	env: Env,
	ctx: WaitUntilContext,
	channel: "mcp" | "cli" = "mcp",
) {
	return (key: string | null, message: string, trace?: SearchTrace) => {
		const route = trace
			? `ingress=${trace.ingress ?? "unknown"} country=${trace.country ?? "unknown"}`
			: "";
		let safeMessage = `[${channel.toUpperCase()}][MODEL] ${message}`;
		if (trace)
			safeMessage += `\nrequest_id=${trace.requestId} ray=${trace.ray ?? "unknown"} ${route}`;
		for (const secret of [
			env.SILICONFLOW_API_KEY,
			env.TYPESAFE_API_KEY,
			env.ZENMUX_API_KEY,
			env.DEEPINFRA_API_KEY,
		]) {
			if (secret) safeMessage = safeMessage.replaceAll(secret, "[REDACTED]");
		}
		console.warn(safeMessage);
		const url = env.TELEGRAM_ALERT_BOT_URL;
		if (!url) return;

		const now = Date.now();
		const alertKey = key && `${url}:${channel}:${route}:${key}`;
		if (alertKey) {
			if (now - (sentAlerts.get(alertKey) ?? -Infinity) < COOLDOWN_MS) return;
			for (const [oldKey, timestamp] of sentAlerts) {
				if (now - timestamp >= COOLDOWN_MS) sentAlerts.delete(oldKey);
			}
			if (sentAlerts.size >= 128) sentAlerts.delete(sentAlerts.keys().next().value!);
			sentAlerts.set(alertKey, now);
		}

		ctx.waitUntil(
			(async () => {
				if (trace) safeMessage += ` worker_trace_colo=${await sampleWorkerColo()}`;
				const delivered = await sendTelegram(url, safeMessage);
				if (!delivered && alertKey && sentAlerts.get(alertKey) === now) sentAlerts.delete(alertKey);
			})(),
		);
	};
}
