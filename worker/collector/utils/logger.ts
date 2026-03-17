import { notifyAlert } from "./telegram-notifier.js";

class Logger {
	info(message: string): void {
		console.log(message);
	}

	async warn(message: string): Promise<void> {
		console.warn(message);
	}

	async error(message: string): Promise<void> {
		console.error(message);
		await notifyAlert(message);
	}
}

export const logger = new Logger();
