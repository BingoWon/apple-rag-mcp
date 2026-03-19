/**
 * Admin MCP Tokens API
 * Administrative access to mcp_tokens table
 */
import { createRoute, z } from "@hono/zod-openapi";
import { logger } from "../../utils/logger";
import { createOpenAPIApp } from "../../utils/openapi";

const app = createOpenAPIApp();

// MCP token schema for admin view (with sensitive data masked)
const AdminMCPTokenSchema = z.object({
	id: z.string(),
	user_id: z.string(),
	name: z.string(),
	mcp_token: z.string(), // Masked for security
	last_used_at: z.string().nullable(),
	created_at: z.string(),
	updated_at: z.string(),
});

const getMCPTokensRoute = createRoute({
	method: "get",
	path: "/",
	summary: "Get MCP tokens with pagination",
	description: "Retrieve MCP tokens with pagination support",
	request: {
		query: z.object({
			limit: z.string().optional().default("50"),
			offset: z.string().optional().default("0"),
		}),
	},
	responses: {
		200: {
			description: "MCP tokens retrieved successfully",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.object({
							tokens: z.array(AdminMCPTokenSchema),
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

app.openapi(getMCPTokensRoute, async (c) => {
	try {
		// Parse pagination parameters
		const limit = Math.min(Number(c.req.query("limit")) || 50, 100); // Max 100 per page
		const offset = Number(c.req.query("offset")) || 0;

		// Get total count
		const countResult = await c.env.DB.prepare("SELECT COUNT(*) as total FROM mcp_tokens").first();

		const total = Number(countResult?.total) || 0;

		// Get paginated tokens (with masked token values)
		const tokensResult = await c.env.DB.prepare(`
      SELECT
        id,
        user_id,
        name,
        mcp_token,
        last_used_at,
        created_at,
        updated_at
      FROM mcp_tokens
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `)
			.bind(limit, offset)
			.all();

		const tokens = (tokensResult.results || []).map((row: Record<string, unknown>) => ({
			id: row.id,
			user_id: row.user_id,
			name: row.name,
			mcp_token: row.mcp_token ? `${String(row.mcp_token).substring(0, 12)}...` : "N/A",
			last_used_at: row.last_used_at,
			created_at: row.created_at,
			updated_at: row.updated_at,
		}));

		return c.json(
			{
				success: true,
				data: {
					tokens,
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
			`Admin MCP tokens fetch error: ${error instanceof Error ? error.message : "Unknown error"}`,
		);

		return c.json(
			{
				success: false,
				error: {
					code: "ADMIN_FETCH_ERROR",
					message: "Failed to fetch MCP tokens data",
				},
			},
			500,
		);
	}
});

export default app;
