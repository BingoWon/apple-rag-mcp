import { sendTelegram } from "./telegram.js";

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
		if (this.alertUrl) {
			await sendTelegram(this.alertUrl, `${this.prefix} ${msg}`);
		}
	}
}
