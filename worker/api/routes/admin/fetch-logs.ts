/**
 * Admin Fetch Logs API
 * Administrative access to fetch_logs table
 */
import { createRoute, z } from "@hono/zod-openapi";
import { TOOL_OUTCOMES, type ToolOutcome } from "../../../shared/tool-outcomes.js";
import { logger } from "../../utils/logger";
import { createOpenAPIApp } from "../../utils/openapi";
import { logConditions, logQuerySchema } from "./log-query.js";
import { adminUserSchema, withAdminUsers } from "./user-identity";

const app = createOpenAPIApp();

const AdminFetchLogSchema = z.object({
	id: z.string(),
	user: adminUserSchema,
	channel: z.enum(["unknown", "mcp", "cli"]),
	credential_id: z.string().nullable(),
	session_id: z.string().nullable(),
	auth_method: z.string().nullable(),
	request_id: z.string().nullable(),
	client_name: z.string().nullable(),
	client_version: z.string().nullable(),
	requested_url: z.string(),
	actual_url: z.string(),
	page_id: z.string().nullable(),
	response_time_ms: z.number().nullable(),
	status_code: z.number().nullable(),
	reason: z.string().nullable(),
	outcome: z.enum(TOOL_OUTCOMES),
	content_source: z.string().nullable(),
	provider: z.string().nullable(),
	upstream_status: z.number().nullable(),
	cache_hit: z.boolean(),
	country_code: z.string().nullable(),
	created_at: z.string(),
});

const getFetchLogsRoute = createRoute({
	method: "get",
	path: "/",
	summary: "Get fetch logs with pagination",
	description: "Retrieve fetch logs with pagination support",
	request: {
		query: logQuerySchema,
	},
	responses: {
		200: {
			description: "Fetch logs retrieved successfully",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.object({
							logs: z.array(AdminFetchLogSchema),
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

app.openapi(getFetchLogsRoute, async (c) => {
	try {
		const query = c.req.valid("query");
		const { limit, offset } = query;
		const { where, values } = logConditions(query, "fetch");
		const countResult = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM fetch_logs${where}`)
			.bind(...values)
			.first();

		const total = Number(countResult?.total) || 0;

		const logsResult = await c.env.DB.prepare(`
      SELECT id, user_id, channel, credential_id, session_id, auth_method, request_id, client_name, client_version, requested_url, actual_url, page_id,
             response_time_ms, status_code, error_code AS reason, outcome, country_code, created_at, content_source, provider, upstream_status, cache_hit
      FROM fetch_logs${where}
      ORDER BY julianday(created_at) DESC, id DESC
      LIMIT ? OFFSET ?
    `)
			.bind(...values, limit, offset)
			.all();

		const logs = (logsResult.results || []).map((row: Record<string, unknown>) => {
			const requestedUrl = row.requested_url as string;
			const actualUrl = (row.actual_url as string) || requestedUrl;
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
				requested_url: requestedUrl,
				actual_url: actualUrl,
				page_id: row.page_id as string | null,
				response_time_ms: row.response_time_ms == null ? null : Number(row.response_time_ms),
				status_code: row.status_code ? Number(row.status_code) : null,
				reason: row.reason as string | null,
				outcome: row.outcome as ToolOutcome,
				content_source: row.content_source as string | null,
				provider: row.provider as string | null,
				upstream_status: row.upstream_status == null ? null : Number(row.upstream_status),
				cache_hit: Boolean(row.cache_hit),
				country_code: row.country_code as string | null,
				created_at: row.created_at as string,
			};
		});

		return c.json(
			{
				success: true,
				data: {
					logs: await withAdminUsers(c.env.DB, logs),
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
			`Failed to fetch admin fetch logs: ${error instanceof Error ? error.message : "Unknown error"}`,
		);

		return c.json(
			{
				success: false,
				error: {
					code: "FETCH_FAILED",
					message: "Failed to retrieve fetch logs",
				},
			},
			500,
		);
	}
});

export default app;
