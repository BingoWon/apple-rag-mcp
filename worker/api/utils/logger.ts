import { notifyTelegram } from "./telegram-notifier.js";

class Logger {
	info(message: string): void {
		console.log(message);
	}

	async warn(message: string): Promise<void> {
		console.warn(message);
	}

	async error(message: string): Promise<void> {
		console.error(message);
		await notifyTelegram(message, "alerts");
	}
}

const logger = new Logger();

export { logger };
