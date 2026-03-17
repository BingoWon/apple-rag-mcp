/**
 * Admin Authorized IPs Routes
 * Admin endpoints for managing authorized IP addresses across all users
 */

import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types/hono";
import { logger } from "../../utils/logger.js";

const app = new OpenAPIHono<AppEnv>();

/**
 * GET /admin/authorized-ips
 * Get authorized IP addresses with pagination
 */
app.get("/", async (c) => {
	try {
		// Parse pagination parameters
		const limit = Math.min(Number(c.req.query("limit")) || 50, 100); // Max 100 per page
		const offset = Number(c.req.query("offset")) || 0;

		// Get total count
		const countResult = await c.env.DB.prepare(
			"SELECT COUNT(*) as total FROM user_authorized_ips",
		).first();

		const total = Number(countResult?.total) || 0;

		// Get paginated authorized IPs
		const query = `
      SELECT
        ai.id,
        ai.user_id,
        ai.name,
        ai.ip_address,
        ai.created_at,
        ai.updated_at,
        ai.last_used_at as last_used,
        u.email as user_email,
        u.name as user_name
      FROM user_authorized_ips ai
      LEFT JOIN users u ON ai.user_id = u.id
      ORDER BY ai.created_at DESC
      LIMIT ? OFFSET ?
    `;

		const result = await c.env.DB.prepare(query).bind(limit, offset).all();

		return c.json({
			success: true,
			data: {
				ips: result.results || [],
				total,
				limit,
				offset,
				hasMore: offset + limit < total,
			},
		});
	} catch (error) {
		console.error("Error fetching admin authorized IPs:", error);
		return c.json(
			{
				success: false,
				error: {
					message: "Failed to fetch authorized IPs",
				},
			},
			500,
		);
	}
});

/**
 * DELETE /admin/authorized-ips/:id
 * Delete an authorized IP address (admin override)
 */
app.delete("/:id", async (c) => {
	try {
		const id = c.req.param("id");

		// Check if the IP exists
		const existingIP = c.env.DB.prepare("SELECT * FROM user_authorized_ips WHERE id = ?")
			.bind(id)
			.first();

		if (!existingIP) {
			return c.json(
				{
					success: false,
					error: {
						message: "Authorized IP not found",
					},
				},
				404,
			);
		}

		// Delete the IP
		const result = await c.env.DB.prepare("DELETE FROM user_authorized_ips WHERE id = ?")
			.bind(id)
			.run();

		if (result.meta?.changes === 0) {
			return c.json(
				{
					success: false,
					error: {
						message: "Authorized IP not found",
					},
				},
				404,
			);
		}

		return c.json({
			success: true,
			data: {
				message: "Authorized IP deleted successfully",
			},
		});
	} catch (error) {
		console.error("Error deleting authorized IP:", error);
		return c.json(
			{
				success: false,
				error: {
					message: "Failed to delete authorized IP",
				},
			},
			500,
		);
	}
});

/**
 * GET /admin/authorized-ips/stats
 * Get authorized IPs statistics
 */
app.get("/stats", async (c) => {
	try {
		const totalIPs = (await c.env.DB.prepare(
			"SELECT COUNT(*) as count FROM user_authorized_ips",
		).first()) as { count: number };

		const totalUsers = (await c.env.DB.prepare(
			"SELECT COUNT(DISTINCT user_id) as count FROM user_authorized_ips",
		).first()) as { count: number };

		const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
		const recentlyUsed = (await c.env.DB.prepare(
			"SELECT COUNT(*) as count FROM user_authorized_ips WHERE last_used_at > ?",
		)
			.bind(sevenDaysAgo)
			.first()) as { count: number };

		return c.json({
			success: true,
			data: {
				totalIPs: totalIPs?.count || 0,
				totalUsers: totalUsers?.count || 0,
				recentlyUsed: recentlyUsed?.count || 0,
			},
		});
	} catch (error) {
		await logger.error(
			`Error fetching authorized IPs stats: ${error instanceof Error ? error.message : String(error)}`,
		);
		return c.json(
			{
				success: false,
				error: {
					message: "Failed to fetch authorized IPs statistics",
				},
			},
			500,
		);
	}
});

export default app;
