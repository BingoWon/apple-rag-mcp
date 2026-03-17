/**
 * Admin Fetch Logs API
 * Administrative access to fetch_logs table
 */
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppEnv } from "../../types/hono";
import { logger } from "../../utils/logger";

const app = new OpenAPIHono<AppEnv>();

const AdminFetchLogSchema = z.object({
	id: z.string(),
	user_id: z.string(),
	mcp_token: z.string().nullable(),
	requested_url: z.string(),
	actual_url: z.string(),
	page_id: z.string().nullable(),
	response_time_ms: z.number().nullable(),
	status_code: z.number().nullable(),
	error_code: z.string().nullable(),
	country_code: z.string().nullable(),
	created_at: z.string(),
});

const getFetchLogsRoute = createRoute({
	method: "get",
	path: "/",
	summary: "Get fetch logs with pagination",
	description: "Retrieve fetch logs with pagination support",
	request: {
		query: z.object({
			limit: z.string().optional().default("50"),
			offset: z.string().optional().default("0"),
		}),
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
		// Parse pagination parameters
		const limit = Math.min(Number(c.req.query("limit")) || 50, 100); // Max 100 per page
		const offset = Number(c.req.query("offset")) || 0;

		// Get total count
		const countResult = await c.env.DB.prepare("SELECT COUNT(*) as total FROM fetch_logs").first();

		const total = Number(countResult?.total) || 0;

		const logsResult = await c.env.DB.prepare(`
      SELECT id, user_id, mcp_token, requested_url, actual_url, page_id,
             response_time_ms, status_code, error_code, country_code, created_at
      FROM fetch_logs
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `)
			.bind(limit, offset)
			.all();

		const logs = (logsResult.results || []).map((row: any) => {
			const requestedUrl = row.requested_url as string;
			const actualUrl = (row.actual_url as string) || requestedUrl;
			return {
				id: row.id as string,
				user_id: row.user_id as string,
				mcp_token: row.mcp_token ? `${row.mcp_token.substring(0, 12)}...` : null,
				requested_url: requestedUrl,
				actual_url: actualUrl,
				page_id: row.page_id as string | null,
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
