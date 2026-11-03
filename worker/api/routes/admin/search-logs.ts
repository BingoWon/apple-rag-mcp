/**
 * Admin Search Logs API
 * Administrative access to search_logs table
 */
import { createRoute, z } from "@hono/zod-openapi";
import { TOOL_OUTCOMES, type ToolOutcome } from "../../../shared/tool-outcomes.js";
import { logger } from "../../utils/logger";
import { createOpenAPIApp } from "../../utils/openapi";

import { logConditions, logQuerySchema } from "./log-query.js";

const app = createOpenAPIApp();

const AdminSearchLogSchema = z.object({
	id: z.string(),
	user_id: z.string(),
	channel: z.enum(["unknown", "mcp", "cli"]),
	credential_id: z.string().nullable(),
	session_id: z.string().nullable(),
	auth_method: z.string().nullable(),
	request_id: z.string().nullable(),
	client_name: z.string().nullable(),
	client_version: z.string().nullable(),
	requested_query: z.string(),
	actual_query: z.string(),
	result_count: z.number(),
	response_time_ms: z.number().nullable(),
	status_code: z.number().nullable(),
	reason: z.string().nullable(),
	outcome: z.enum(TOOL_OUTCOMES),
	country_code: z.string().nullable(),
	created_at: z.string(),
});

const getSearchLogsRoute = createRoute({
	method: "get",
	path: "/",
	summary: "Get search logs with pagination",
	description: "Retrieve search logs with pagination support",
	request: {
		query: logQuerySchema,
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
		const query = c.req.valid("query");
		const { limit, offset } = query;
		const { where, values } = logConditions(query, "search");
		const countResult = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM search_logs${where}`)
			.bind(...values)
			.first();

		const total = Number(countResult?.total) || 0;

		const logsResult = await c.env.DB.prepare(`
      SELECT id, user_id, channel, credential_id, session_id, auth_method, request_id, client_name, client_version, requested_query, actual_query, result_count,
             response_time_ms, status_code, error_code AS reason, outcome, country_code, created_at
      FROM search_logs${where}
      ORDER BY julianday(created_at) DESC, id DESC
      LIMIT ? OFFSET ?
    `)
			.bind(...values, limit, offset)
			.all();

		const logs = (logsResult.results || []).map((row: Record<string, unknown>) => {
			const requestedQuery = (row.requested_query as string) || "";
			const actualQuery = (row.actual_query as string) || requestedQuery;
			return {
				id: row.id as string,
				user_id: row.user_id as string,
				channel: row.channel as "unknown" | "mcp" | "cli",
				credential_id: row.credential_id as string | null,
				session_id: row.session_id as string | null,
				auth_method: row.auth_method as string | null,
				request_id: row.request_id as string | null,
				client_name: row.client_name as string | null,
				client_version: row.client_version as string | null,
				requested_query: requestedQuery,
				actual_query: actualQuery,
				result_count: Number(row.result_count) || 0,
				response_time_ms: row.response_time_ms == null ? null : Number(row.response_time_ms),
				status_code: row.status_code ? Number(row.status_code) : null,
				reason: row.reason as string | null,
				outcome: row.outcome as ToolOutcome,
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
