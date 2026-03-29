/**
 * MCP Tool Call Logs Routes
 * Modern implementation for tracking separated search and fetch tool call logs
 */
import { createRoute, z } from "@hono/zod-openapi";
import { ApiErrorCode } from "../constants/error-codes";
import { authMiddleware } from "../middleware/auth";
import type { User } from "../types";
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
	mcp_token: z.string().nullable(),
	created_at: z.string(),
	log_type: z.enum(["search", "fetch"]),
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
		query: z.object({
			page: z.coerce.number().int().min(1).optional().default(1),
			limit: z.coerce.number().int().min(1).max(100).optional().default(20),
			status: z.enum(["success", "error", "all"]).optional().default("all"),
			search: z.string().optional(),
			log_type: z.enum(["search", "fetch", "all"]).optional().default("all"),
		}),
	},
	responses: {
		200: {
			description: "MCP usage logs retrieved successfully",
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
	const { page, limit, status, search, log_type } = c.req.valid("query");

	try {
		const offset = (page - 1) * limit;

		// Build dynamic WHERE conditions
		const buildConditions = (tablePrefix: string) => {
			const conditions = [`${tablePrefix}.user_id = ?`];
			const params = [user.id];

			if (status !== "all") {
				conditions.push(`${tablePrefix}.status_code = ?`);
				params.push(status === "success" ? "200" : "500");
			}

			if (search) {
				if (tablePrefix === "s") {
					conditions.push(`s.requested_query LIKE ?`);
				} else {
					conditions.push(`f.requested_url LIKE ?`);
				}
				params.push(`%${search}%`);
			}

			return { conditions: conditions.join(" AND "), params };
		};

		// Execute queries based on log_type
		let countQuery: string;
		let dataQuery: string;
		let queryParams: unknown[];

		if (log_type === "search") {
			const { conditions, params } = buildConditions("s");
			countQuery = `SELECT COUNT(*) as total FROM search_logs s WHERE ${conditions}`;
			dataQuery = `
        SELECT s.id, s.requested_query as query, s.result_count,
               CASE WHEN s.status_code = 200 THEN 'success' ELSE 'error' END as status,
               s.mcp_token, s.created_at, 'search' as log_type
        FROM search_logs s
        WHERE ${conditions}
        ORDER BY s.created_at DESC
        LIMIT ? OFFSET ?`;
			queryParams = [...params, limit, offset];
		} else if (log_type === "fetch") {
			const { conditions, params } = buildConditions("f");
			countQuery = `SELECT COUNT(*) as total FROM fetch_logs f WHERE ${conditions}`;
			dataQuery = `
        SELECT f.id, f.requested_url as query, 1 as result_count,
               CASE WHEN f.status_code = 200 THEN 'success' ELSE 'error' END as status,
               f.mcp_token, f.created_at, 'fetch' as log_type
        FROM fetch_logs f
        WHERE ${conditions}
        ORDER BY f.created_at DESC
        LIMIT ? OFFSET ?`;
			queryParams = [...params, limit, offset];
		} else {
			// log_type === "all" - Use UNION for optimal performance
			const searchConditions = buildConditions("s");
			const fetchConditions = buildConditions("f");

			countQuery = `
        SELECT (
          (SELECT COUNT(*) FROM search_logs s WHERE ${searchConditions.conditions}) +
          (SELECT COUNT(*) FROM fetch_logs f WHERE ${fetchConditions.conditions})
        ) as total`;

			dataQuery = `
        (SELECT s.id, s.requested_query as query, s.result_count,
                CASE WHEN s.status_code = 200 THEN 'success' ELSE 'error' END as status,
                s.mcp_token, s.created_at, 'search' as log_type
         FROM search_logs s WHERE ${searchConditions.conditions})
        UNION ALL
        (SELECT f.id, f.requested_url as query, 1 as result_count,
                CASE WHEN f.status_code = 200 THEN 'success' ELSE 'error' END as status,
                f.mcp_token, f.created_at, 'fetch' as log_type
         FROM fetch_logs f WHERE ${fetchConditions.conditions})
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?`;

			queryParams = [...searchConditions.params, ...fetchConditions.params, limit, offset];
		}

		// Execute count query
		const countResult = await c.env.DB.prepare(countQuery)
			.bind(
				...(log_type === "all"
					? [...buildConditions("s").params, ...buildConditions("f").params]
					: buildConditions(log_type === "search" ? "s" : "f").params),
			)
			.first();

		const total = Number(countResult?.total) || 0;
		const totalPages = Math.ceil(total / limit);

		// Execute data query
		const dataResult = await c.env.DB.prepare(dataQuery)
			.bind(...queryParams)
			.all();

		const items = (dataResult.results || []).map((row: Record<string, unknown>) => ({
			id: String(row.id),
			query: row.query ? String(row.query) : null,
			result_count: Number(row.result_count) || 0,
			status: row.status as "success" | "error",
			mcp_token: row.mcp_token ? `${String(row.mcp_token).substring(0, 12)}...` : null,
			created_at: String(row.created_at),
			log_type: row.log_type as "search" | "fetch",
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
