import { createRoute, z } from "@hono/zod-openapi";
import { TOOL_KINDS } from "../../../shared/tool-activity.js";
import { ApiErrorCode } from "../constants/error-codes";
import { authMiddleware } from "../middleware/auth";
import type { User } from "../types";
import { logWindowPredicate, logWindowValues } from "../utils/activity";
import { logger } from "../utils/logger";
import { createOpenAPIApp } from "../utils/openapi";

const app = createOpenAPIApp();

// Apply JWT authentication middleware to all routes
app.use("*", authMiddleware);

// Modern Usage Log schemas
const UsageLogItemSchema = z.object({
	id: z.string(),
	query: z.string().nullable(),
	result_count: z.number(),
	status: z.enum(["success", "error"]),
	channel: z.enum(["mcp", "cli", "unknown"]),
	credential_id: z.string().nullable(),
	request_id: z.string().nullable(),
	response_time_ms: z.number().nullable(),
	created_at: z.string(),
	log_type: z.enum(TOOL_KINDS),
});

const PaginationSchema = z.object({
	page: z.number(),
	limit: z.number(),
	total: z.number(),
	total_pages: z.number(),
	has_next: z.boolean(),
	has_prev: z.boolean(),
});

const getUsageLogsRoute = createRoute({
	method: "get",
	path: "/history",
	request: {
		query: z
			.object({
				page: z.coerce.number().int().min(1).optional().default(1),
				limit: z.coerce.number().int().min(1).max(100).optional().default(20),
				status: z.enum(["success", "error", "all"]).optional().default("all"),
				search: z.string().max(2048).optional(),
				log_type: z
					.enum([...TOOL_KINDS, "all"])
					.optional()
					.default("all"),
				from: z.iso.datetime({ offset: true }).optional(),
				to: z.iso.datetime({ offset: true }).optional(),
			})
			.refine(
				(q) =>
					(q.from === undefined && q.to === undefined) ||
					(!!q.from && !!q.to && Date.parse(q.from) < Date.parse(q.to)),
				{ message: "Provide an ordered pair of timestamps.", path: ["from"] },
			),
	},
	responses: {
		200: {
			description: "Usage logs retrieved successfully",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.object({
							items: z.array(UsageLogItemSchema),
							pagination: PaginationSchema,
						}),
					}),
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						error: z.object({
							code: z.string(),
							message: z.string(),
						}),
					}),
				},
			},
		},
		500: {
			description: "Internal Server Error",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						error: z.object({
							code: z.string(),
							message: z.string(),
						}),
					}),
				},
			},
		},
	},
	tags: ["Usage Logs"],
});

app.openapi(getUsageLogsRoute, async (c) => {
	const user = c.get("user") as User;
	const { page, limit, status, search, log_type, from, to } = c.req.valid("query");

	try {
		const offset = (page - 1) * limit;

		const kinds = log_type === "all" ? TOOL_KINDS : [log_type];
		const parameters: (string | number)[] = [];
		const selects = kinds.map((kind) => {
			const field = kind === "search" ? "requested_query" : "requested_url";
			const conditions = ["user_id = ?"];
			parameters.push(user.id);
			if (from && to) {
				conditions.push(logWindowPredicate);
				parameters.push(...logWindowValues(from, to));
			}
			if (status !== "all")
				conditions.push(status === "success" ? "status_code=200" : "status_code>=400");
			if (search) {
				conditions.push(`instr(lower(${field}),lower(?))>0`);
				parameters.push(search);
			}
			return `SELECT id,${field} AS query,${kind !== "fetch" ? "result_count" : "CASE WHEN status_code=200 THEN 1 ELSE 0 END"} AS result_count,
                CASE WHEN status_code=200 THEN 'success' ELSE 'error' END AS status,
                channel,credential_id,request_id,response_time_ms,created_at,'${kind}' AS log_type FROM ${kind}_logs WHERE ${conditions.join(" AND ")}`;
		});
		const union = selects.join(" UNION ALL ");
		const countResult = await c.env.DB.prepare(`SELECT count(*) AS total FROM (${union})`)
			.bind(...parameters)
			.first();

		const total = Number(countResult?.total) || 0;
		const totalPages = Math.ceil(total / limit);

		// Execute data query
		const dataResult = await c.env.DB.prepare(
			`SELECT * FROM (${union}) ORDER BY julianday(created_at) DESC,id DESC LIMIT ? OFFSET ?`,
		)
			.bind(...parameters, limit, offset)
			.all();

		const items = (dataResult.results || []).map((row: Record<string, unknown>) => ({
			id: String(row.id),
			query: row.query ? String(row.query) : null,
			result_count: Number(row.result_count) || 0,
			status: row.status as "success" | "error",
			channel: row.channel as "mcp" | "cli" | "unknown",
			credential_id: row.credential_id as string | null,
			request_id: row.request_id as string | null,
			response_time_ms: row.response_time_ms == null ? null : Number(row.response_time_ms),
			created_at: String(row.created_at),
			log_type: row.log_type as "search" | "fetch" | "browse",
		}));

		const pagination = {
			page,
			limit,
			total,
			total_pages: totalPages,
			has_next: page < totalPages,
			has_prev: page > 1,
		};

		return c.json(
			{
				success: true,
				data: {
					items,
					pagination,
				},
			},
			200,
		);
	} catch (error) {
		await logger.error(
			`Failed to fetch usage logs for user ${user.id}: ${error instanceof Error ? error.message : "Unknown error"}`,
		);

		return c.json(
			{
				success: false,
				error: {
					code: ApiErrorCode.INTERNAL_ERROR,
					message: "Failed to retrieve usage logs",
				},
			},
			500,
		);
	}
});

export default app;
