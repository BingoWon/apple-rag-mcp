import { z } from "@hono/zod-openapi";
import { TOOL_CHANNELS } from "../../../shared/tool-channels.js";
import { TOOL_OUTCOMES } from "../../../shared/tool-outcomes.js";

export const logQuerySchema = z
	.object({
		limit: z.coerce.number().int().min(1).max(100).default(50),
		offset: z.coerce.number().int().min(0).default(0),
		q: z.string().max(2048).optional(),
		channel: z.enum(TOOL_CHANNELS).optional(),
		outcome: z.enum(TOOL_OUTCOMES).optional(),
		reason: z.string().max(100).optional(),
		source: z.enum(["apple", "third_party"]).optional(),
		provider: z.enum(["index", "apple_json", "apple_http", "firecrawl"]).optional(),
		cache: z.enum(["hit", "miss"]).optional(),
		start: z.iso.date().optional(),
		end: z.iso.date().optional(),
		from: z.iso.datetime({ offset: true }).optional(),
		to: z.iso.datetime({ offset: true }).optional(),
	})
	.refine((q) => !q.start || !q.end || q.start <= q.end, {
		message: "Start date must not be after end date",
		path: ["end"],
	})
	.refine((q) => !q.from || !q.to || Date.parse(q.from) < Date.parse(q.to), {
		message: "From must be before to",
		path: ["to"],
	})
	.refine((q) => !(q.from || q.to) || !(q.start || q.end), {
		message: "Use either exact timestamps or calendar dates",
		path: ["from"],
	});

export function logConditions(
	query: z.output<typeof logQuerySchema>,
	kind: "search" | "fetch" | "browse",
) {
	const clauses: string[] = [],
		values: (string | number)[] = [];
	const equal = (column: string, value: string | number | undefined) => {
		if (value !== undefined) {
			clauses.push(`${column} = ?`);
			values.push(value);
		}
	};
	equal("channel", query.channel);
	equal("outcome", query.outcome);
	equal("error_code", query.reason);
	if (query.from) {
		clauses.push("julianday(created_at) >= julianday(?)");
		values.push(query.from);
	}
	if (query.to) {
		clauses.push("julianday(created_at) < julianday(?)");
		values.push(query.to);
	}
	if (kind === "fetch") {
		equal("content_source", query.source);
		equal("provider", query.provider);
		equal("cache_hit", query.cache === undefined ? undefined : query.cache === "hit" ? 1 : 0);
	}
	if (query.q?.trim()) {
		const fields =
			kind === "browse"
				? ["requested_url", "(SELECT name FROM users WHERE users.id = browse_logs.user_id)"]
				: kind === "fetch"
					? [
							"requested_url",
							"actual_url",
							"(SELECT name FROM users WHERE users.id = fetch_logs.user_id)",
						]
					: [
							"requested_query",
							"actual_query",
							"(SELECT name FROM users WHERE users.id = search_logs.user_id)",
						];
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
