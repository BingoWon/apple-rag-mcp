import { notifyTelegram } from "./telegram-notifier.js";

class Logger {
  private ctx?: ExecutionContext;

  setContext(ctx: ExecutionContext): void {
    this.ctx = ctx;
  }

  getContext(): ExecutionContext | undefined {
    return this.ctx;
  }

  info(message: string): void {
    console.log(message);
  }

  warn(message: string): void {
    console.warn(message);
  }

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
