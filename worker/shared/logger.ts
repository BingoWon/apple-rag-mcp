import { sendTelegram } from "./telegram.js";

let globalAlertUrl: string | undefined;

export function setGlobalAlertUrl(url: string | undefined): void {
	globalAlertUrl = url;
}

export class Logger {
	private alertUrl?: string;
	private prefix: string;

	constructor(prefix: string) {
		this.prefix = prefix;
	}

	setAlertUrl(url: string | undefined): void {
		this.alertUrl = url;
	}

	info(msg: string): void {
		console.log(msg);
	}

	warn(msg: string): void {
		console.warn(msg);
	}

	async error(msg: string): Promise<void> {
		console.error(msg);
		const target = this.alertUrl ?? globalAlertUrl;
		if (target) {
			await sendTelegram(target, `${this.prefix} ${msg}`);
		}
	}
}

export const logger = new Logger("[Apple RAG]");
