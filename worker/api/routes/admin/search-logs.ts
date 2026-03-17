/**
 * Admin Search Logs API
 * Administrative access to search_logs table
 */
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppEnv } from "../../types/hono";
import { logger } from "../../utils/logger";

const app = new OpenAPIHono<AppEnv>();

const AdminSearchLogSchema = z.object({
	id: z.string(),
	user_id: z.string(),
	mcp_token: z.string().nullable(),
	requested_query: z.string(),
	actual_query: z.string(),
	result_count: z.number(),
	response_time_ms: z.number().nullable(),
	status_code: z.number().nullable(),
	error_code: z.string().nullable(),
	country_code: z.string().nullable(),
	created_at: z.string(),
});

const getSearchLogsRoute = createRoute({
	method: "get",
	path: "/",
	summary: "Get search logs with pagination",
	description: "Retrieve search logs with pagination support",
	request: {
		query: z.object({
			limit: z.string().optional().default("50"),
			offset: z.string().optional().default("0"),
		}),
	},
	responses: {
		200: {
			description: "Search logs retrieved successfully",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.object({
							logs: z.array(AdminSearchLogSchema),
							total: z.number(),
							limit: z.number(),
							offset: z.number(),
							hasMore: z.boolean(),
						}),
					}),
				},
			},
		},
		500: {
			description: "Internal server error",
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
	tags: ["Admin"],
});

app.openapi(getSearchLogsRoute, async (c) => {
	try {
		// Parse pagination parameters
		const limit = Math.min(Number(c.req.query("limit")) || 50, 100); // Max 100 per page
		const offset = Number(c.req.query("offset")) || 0;

		// Get total count
		const countResult = await c.env.DB.prepare("SELECT COUNT(*) as total FROM search_logs").first();

		const total = Number(countResult?.total) || 0;

		const logsResult = await c.env.DB.prepare(`
      SELECT id, user_id, mcp_token, requested_query, actual_query, result_count,
             response_time_ms, status_code, error_code, country_code, created_at
      FROM search_logs
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `)
			.bind(limit, offset)
			.all();

		const truncate = (s: string, max: number): string =>
			s.length > max ? `${s.substring(0, max)}...` : s;

		const logs = (logsResult.results || []).map((row: Record<string, unknown>) => {
			const requestedQuery = (row.requested_query as string) || "";
			const actualQuery = (row.actual_query as string) || requestedQuery;
			return {
				id: row.id as string,
				user_id: row.user_id as string,
				mcp_token: row.mcp_token ? `${String(row.mcp_token).substring(0, 12)}...` : null,
				requested_query: truncate(requestedQuery, 80),
				actual_query: truncate(actualQuery, 80),
				result_count: Number(row.result_count) || 0,
				response_time_ms: row.response_time_ms ? Number(row.response_time_ms) : null,
				status_code: row.status_code ? Number(row.status_code) : null,
				error_code: row.error_code as string | null,
				country_code: row.country_code as string | null,
				created_at: row.created_at as string,
			};
		});

		return c.json(
			{
				success: true,
				data: {
					logs,
					total,
					limit,
					offset,
					hasMore: offset + limit < total,
				},
			},
			200,
		);
	} catch (error) {
		await logger.error(
			`Failed to fetch admin search logs: ${error instanceof Error ? error.message : "Unknown error"}`,
		);

		return c.json(
			{
				success: false,
				error: {
					code: "FETCH_FAILED",
					message: "Failed to retrieve search logs",
				},
			},
			500,
		);
	}
});

export default app;
