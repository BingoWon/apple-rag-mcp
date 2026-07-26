const TRANSIENT_POSTGRES_CODES = new Set([
	"08000",
	"08001",
	"08003",
	"08004",
	"08006",
	"08P01",
	"57P01",
	"57P02",
	"57P03",
	"CONNECT_TIMEOUT",
	"CONNECTION_CLOSED",
	"CONNECTION_DESTROYED",
	"CONNECTION_ENDED",
	"ECONNRESET",
	"EPIPE",
	"ETIMEDOUT",
]);

interface RetryNotification {
	readonly attempt: number;
	readonly maxAttempts: number;
	readonly delayMs: number;
	readonly error: unknown;
}

interface PostgresRetryOptions {
	readonly maxAttempts?: number;
	readonly baseDelayMs?: number;
	readonly onRetry?: (notification: RetryNotification) => void;
	readonly sleep?: (delayMs: number) => Promise<void>;
}

export async function retryTransientPostgres<T>(
	operation: () => Promise<T>,
	options: PostgresRetryOptions = {},
): Promise<T> {
	const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
	const baseDelayMs = Math.max(0, options.baseDelayMs ?? 250);
	const sleep =
		options.sleep ?? ((delayMs: number) => new Promise((resolve) => setTimeout(resolve, delayMs)));

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			return await operation();
		} catch (error) {
			if (attempt === maxAttempts || !isTransientPostgresConnectionError(error)) {
				throw error;
			}

			const delayMs = baseDelayMs * 2 ** (attempt - 1);
			options.onRetry?.({
				attempt: attempt + 1,
				maxAttempts,
				delayMs,
				error,
			});
			await sleep(delayMs);
		}
	}

	throw new Error("PostgreSQL retry loop completed unexpectedly");
}

export function isTransientPostgresConnectionError(error: unknown): boolean {
	const code = readErrorField(error, "code") ?? readErrorField(error, "errno");
	if (code && (TRANSIENT_POSTGRES_CODES.has(code) || code.startsWith("08"))) {
		return true;
	}

	const message = error instanceof Error ? error.message : String(error);
	return /CONNECTION_(?:CLOSED|DESTROYED|ENDED)|CONNECT_TIMEOUT|ECONNRESET|EPIPE|ETIMEDOUT|connection reset|socket (?:closed|ended)|broken pipe/i.test(
		message,
	);
}

function readErrorField(error: unknown, field: "code" | "errno"): string | null {
	if (!error || typeof error !== "object" || !(field in error)) return null;
	const value = (error as Record<string, unknown>)[field];
	return typeof value === "string" ? value.toUpperCase() : null;
}
