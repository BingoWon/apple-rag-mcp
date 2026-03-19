/**
 * Admin Users API
 * Administrative access to users table
 */
import { createRoute, z } from "@hono/zod-openapi";
import { logger } from "../../utils/logger";
import { createOpenAPIApp } from "../../utils/openapi";

const app = createOpenAPIApp();

// User schema for admin view (with sensitive data masked)
const AdminUserSchema = z.object({
	id: z.string(),
	email: z.string(),
	name: z.string(),
	provider: z.string().optional(),
	avatar: z.string().optional(),
	plan_type: z.string(),
	subscription_status: z.string(),
	last_login: z.string().optional(),
	created_at: z.string(),
	updated_at: z.string(),
	// Sensitive fields excluded: password_hash, provider_id, reset_token, stripe_customer_id
});

const getUsersRoute = createRoute({
	method: "get",
	path: "/",
	summary: "Get users with pagination",
	description: "Retrieve users with pagination support",
	request: {
		query: z.object({
			limit: z.string().optional().default("50"),
			offset: z.string().optional().default("0"),
		}),
	},
	responses: {
		200: {
			description: "Users retrieved successfully",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.object({
							users: z.array(AdminUserSchema),
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

app.openapi(getUsersRoute, async (c) => {
	try {
		// Parse pagination parameters
		const limit = Math.min(Number(c.req.query("limit")) || 50, 100); // Max 100 per page
		const offset = Number(c.req.query("offset")) || 0;

		// Get total count
		const countResult = await c.env.DB.prepare("SELECT COUNT(*) as total FROM users").first();

		const total = Number(countResult?.total) || 0;

		// Get paginated users with subscription info (excluding sensitive fields)
		const usersResult = await c.env.DB.prepare(`
      SELECT
        u.id,
        u.email,
        u.name,
        u.provider,
        u.avatar,
        u.last_login,
        u.created_at,
        u.updated_at,
        COALESCE(us.plan_type, 'hobby') as plan_type,
        COALESCE(us.status, 'active') as subscription_status
      FROM users u
      LEFT JOIN user_subscriptions us ON u.id = us.user_id
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `)
			.bind(limit, offset)
			.all();

		const users = (usersResult.results || []).map((row: Record<string, unknown>) => ({
			id: row.id,
			email: row.email,
			name: row.name || "N/A",
			provider: row.provider || "email",
			avatar: row.avatar || null,
			plan_type: row.plan_type || "hobby",
			subscription_status: row.subscription_status || "active",
			last_login: row.last_login || null,
			created_at: row.created_at,
			updated_at: row.updated_at,
		}));

		return c.json(
			{
				success: true,
				data: {
					users,
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
			`Admin users fetch error: ${error instanceof Error ? error.message : "Unknown error"}`,
		);

		return c.json(
			{
				success: false,
				error: {
					code: "ADMIN_FETCH_ERROR",
					message: "Failed to fetch users data",
				},
			},
			500,
		);
	}
});

export default app;
