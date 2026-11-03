import { z } from "@hono/zod-openapi";
import { TOOL_OUTCOMES } from "../../../shared/tool-outcomes.js";

export const logQuerySchema = z
	.object({
		limit: z.coerce.number().int().min(1).max(100).default(50),
		offset: z.coerce.number().int().min(0).default(0),
		q: z.string().max(2048).optional(),
		outcome: z.enum(TOOL_OUTCOMES).optional(),
		reason: z.string().max(100).optional(),
		source: z.enum(["apple", "third_party"]).optional(),
		provider: z.enum(["index", "apple_json", "apple_http", "firecrawl"]).optional(),
		cache: z.enum(["hit", "miss"]).optional(),
		start: z.iso.date().optional(),
		end: z.iso.date().optional(),
	})
	.refine((q) => !q.start || !q.end || q.start <= q.end, {
		message: "Start date must not be after end date",
		path: ["end"],
	});

export function logConditions(query: z.output<typeof logQuerySchema>, kind: "search" | "fetch") {
	const clauses: string[] = [],
		values: (string | number)[] = [];
	const equal = (column: string, value: string | number | undefined) => {
		if (value !== undefined) {
			clauses.push(`${column} = ?`);
			values.push(value);
		}
	};
	equal("outcome", query.outcome);
	equal("error_code", query.reason);
	if (kind === "fetch") {
		equal("content_source", query.source);
		equal("provider", query.provider);
		equal("cache_hit", query.cache === undefined ? undefined : query.cache === "hit" ? 1 : 0);
	}
	if (query.q?.trim()) {
		const fields =
			kind === "fetch"
				? ["requested_url", "actual_url", "user_id"]
				: ["requested_query", "actual_query", "user_id"];
		// INSTR supports long URLs and treats %, _ and quotes literally (D1 LIKE is limited to 50 bytes).
		clauses.push(
			`(${fields.map((f) => `instr(lower(coalesce(${f},'')),lower(?)) > 0`).join(" OR ")})`,
		);
		values.push(...fields.map(() => query.q!.trim()));
	}
	if (query.start) {
		clauses.push("julianday(created_at) >= julianday(?)");
		values.push(`${query.start}T00:00:00+08:00`);
	}
	if (query.end) {
		clauses.push("julianday(created_at) < julianday(?)");
		values.push(new Date(Date.parse(`${query.end}T00:00:00+08:00`) + 86400000).toISOString());
	}
	return { where: clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "", values };
}
