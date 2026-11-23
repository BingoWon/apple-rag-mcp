export const MICROSOFT_DECISION_MODEL = "microsoft/microsoft-decision-1.1";

export interface EmbeddingAttempt {
	provider: "SiliconFlow" | "DeepInfra";
	attempt: number;
	timeout_ms: number;
	elapsed_ms: number;
	outcome:
		| "success"
		| "timeout"
		| "cancelled"
		| "http_error"
		| "invalid_response"
		| "network_error";
	http_status?: number;
}

export interface ModelUsageEvent {
	category: "jev" | "embedding" | "reranking";
	model?: string;
	inputTokens?: number;
	currency?: "USD" | "CNY";
	costNanos?: number;
	costSource?: "estimated" | "reported";
}

export type ModelUsageRecorder = (event: ModelUsageEvent) => void;

export function pricedModelUsage(
	category: ModelUsageEvent["category"],
	inputTokens: unknown,
	currency: NonNullable<ModelUsageEvent["currency"]>,
	nanosPerToken: number,
): ModelUsageEvent {
	if (typeof inputTokens !== "number" || !Number.isSafeInteger(inputTokens) || inputTokens < 0) {
		return { category };
	}
	const costNanos = inputTokens * nanosPerToken;
	return Number.isSafeInteger(costNanos)
		? { category, inputTokens, currency, costNanos, costSource: "estimated" }
		: { category, inputTokens };
}

export function createModelUsageRecorder(
	db: D1Database,
	channel?: "mcp" | "cli",
	requestId?: string,
) {
	const events: Array<ModelUsageEvent & { createdAt: string; attempt?: EmbeddingAttempt }> = [];
	const record = (event: ModelUsageEvent, attempt?: EmbeddingAttempt) => {
		events.push({ ...event, attempt, createdAt: new Date().toISOString() });
	};

	return {
		record,
		async flush(): Promise<void> {
			if (!events.length) return;
			const batch = events.splice(0);
			try {
				await db.batch(
					batch.map((event) =>
						db
							.prepare(
								`INSERT INTO model_usage_events
							(created_at, category, channel, input_tokens, currency, cost_nanos, cost_source,
							 request_id, provider, attempt_no, timeout_ms, elapsed_ms, attempt_outcome, http_status, model)
							VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
							)
							.bind(
								event.createdAt,
								event.category,
								channel ?? null,
								event.inputTokens ?? null,
								event.currency ?? null,
								event.costNanos ?? null,
								event.costSource ?? null,
								requestId ?? null,
								event.attempt?.provider ?? null,
								event.attempt?.attempt ?? null,
								event.attempt?.timeout_ms ?? null,
								event.attempt?.elapsed_ms ?? null,
								event.attempt?.outcome ?? null,
								event.attempt?.http_status ?? null,
								event.model ?? null,
							),
					),
				);
			} catch (error) {
				console.error(`Model usage write failed for ${batch.length} attempts: ${String(error)}`);
			}
		},
	};
}
