export interface ModelUsageEvent {
	category: "jev" | "embedding" | "reranking";
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

export function createModelUsageRecorder(db: D1Database, channel?: "mcp" | "cli") {
	const events: Array<ModelUsageEvent & { createdAt: string }> = [];
	const record: ModelUsageRecorder = (event) => {
		events.push({ ...event, createdAt: new Date().toISOString() });
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
							(created_at, category, channel, input_tokens, currency, cost_nanos, cost_source)
							VALUES (?, ?, ?, ?, ?, ?, ?)`,
							)
							.bind(
								event.createdAt,
								event.category,
								channel ?? null,
								event.inputTokens ?? null,
								event.currency ?? null,
								event.costNanos ?? null,
								event.costSource ?? null,
							),
					),
				);
			} catch (error) {
				console.error(`Model usage write failed for ${batch.length} attempts: ${String(error)}`);
			}
		},
	};
}
