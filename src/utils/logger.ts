import { notifyTelegram } from "./telegram-notifier.js";

class Logger {
  private ctx?: ExecutionContext;

  /**
   * Set ExecutionContext for waitUntil support
   * Must be called at the start of each request
   */
  setContext(ctx: ExecutionContext): void {
    this.ctx = ctx;
  }

  info(message: string): void {
    console.log(message);
  }

  warn(message: string): void {
    console.warn(message);
  }

  /**
   * Log error and send Telegram notification
   * Uses ctx.waitUntil() to ensure notification completes before Worker terminates
   */
  error(message: string): void {
    console.error(message);
    const promise = notifyTelegram(message);
    if (this.ctx) {
      this.ctx.waitUntil(promise);
    }
  }
}

const logger = new Logger();

export { logger };
