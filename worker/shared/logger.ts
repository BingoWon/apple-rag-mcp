import { sendTelegram } from "./telegram.js";

export class Logger {
	private ctx?: ExecutionContext;
	private alertUrl?: string;
	private prefix: string;

	constructor(prefix: string) {
		this.prefix = prefix;
	}

	setContext(ctx: ExecutionContext): void {
		this.ctx = ctx;
	}

	getContext(): ExecutionContext | undefined {
		return this.ctx;
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

	error(msg: string): void {
		console.error(msg);
		if (this.alertUrl) {
			const p = sendTelegram(this.alertUrl, `${this.prefix} ${msg}`);
			if (this.ctx) this.ctx.waitUntil(p);
		}
	}
}
