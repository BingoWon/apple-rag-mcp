/**
 * User Authorized IPs API
 * Manages IP-based authentication for users
 */
import { Hono } from "hono";
import { ApiErrorCode } from "../constants/error-codes";
import { authMiddleware } from "../middleware/auth";
import type { User } from "../types";
import type { AppEnv } from "../types/hono";
import { logger } from "../utils/logger";

const app = new Hono<AppEnv>();

// Apply auth middleware to all routes first
app.use("*", authMiddleware);

// IP validation regex (IPv4 and IPv6)
const IP_REGEX =
	/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;

// List user's authorized IPs
app.get("/", async (c) => {
	const user = c.get("user") as User;

	try {
		const ips = await c.env.DB.prepare(
			`SELECT id, ip_address, name, last_used_at, created_at, updated_at 
       FROM user_authorized_ips 
       WHERE user_id = ? 
       ORDER BY created_at DESC`,
		)
			.bind(user.id)
			.all();

		return c.json({
			success: true,
			data: ips.results || [],
		});
	} catch (error) {
		await logger.error(
			`Failed to list authorized IPs for user ${user.id}: ${error instanceof Error ? error.message : String(error)}`,
		);

		return c.json(
			{
				success: false,
				error: {
					code: ApiErrorCode.INTERNAL_ERROR,
					message: "Failed to list authorized IPs",
				},
			},
			500,
		);
	}
});

// Create a new authorized IP
app.post("/", async (c) => {
	const user = c.get("user") as User;

	try {
		const body = await c.req.json();
		const { ip_address, name } = body;

		// Validate input
		if (!ip_address || !name) {
			return c.json(
				{
					success: false,
					error: {
						code: ApiErrorCode.VALIDATION_ERROR,
						message: "IP address and name are required",
					},
				},
				400,
			);
		}

		// Validate IP format
		if (!IP_REGEX.test(ip_address)) {
			return c.json(
				{
					success: false,
					error: {
						code: ApiErrorCode.VALIDATION_ERROR,
						message: "Invalid IP address format",
					},
				},
				400,
			);
		}

		// Check if IP already exists for this user
		const existingIP = await c.env.DB.prepare(
			"SELECT id FROM user_authorized_ips WHERE user_id = ? AND ip_address = ?",
		)
			.bind(user.id, ip_address)
			.first();

		if (existingIP) {
			return c.json(
				{
					success: false,
					error: {
						code: ApiErrorCode.RESOURCE_CONFLICT,
						message: "IP address already authorized",
					},
				},
				409,
			);
		}

		// Create new authorized IP
		const id = crypto.randomUUID();
		const now = new Date().toISOString();

		await c.env.DB.prepare(
			`INSERT INTO user_authorized_ips (id, user_id, ip_address, name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
		)
			.bind(id, user.id, ip_address, name, now, now)
			.run();

		const newIP = await c.env.DB.prepare(
			"SELECT id, ip_address, name, last_used_at, created_at, updated_at FROM user_authorized_ips WHERE id = ?",
		)
			.bind(id)
			.first();

		return c.json(
			{
				success: true,
				data: newIP,
			},
			201,
		);
	} catch (error) {
		await logger.error(
			`Failed to create authorized IP for user ${user.id}: ${error instanceof Error ? error.message : String(error)}`,
		);

		return c.json(
			{
				success: false,
				error: {
					code: ApiErrorCode.INTERNAL_ERROR,
					message: "Failed to create authorized IP",
				},
			},
			500,
		);
	}
});

// Update an authorized IP
app.put("/:id", async (c) => {
	const user = c.get("user") as User;
	const { id } = c.req.param();

	try {
		const body = await c.req.json();
		const { name } = body;

		if (!name) {
			return c.json(
				{
					success: false,
					error: {
						code: ApiErrorCode.VALIDATION_ERROR,
						message: "Name is required",
					},
				},
				400,
			);
		}

		// Check if IP exists and belongs to user
		const existingIP = await c.env.DB.prepare(
			"SELECT id FROM user_authorized_ips WHERE id = ? AND user_id = ?",
		)
			.bind(id, user.id)
			.first();

		if (!existingIP) {
			return c.json(
				{
					success: false,
					error: {
						code: ApiErrorCode.RESOURCE_NOT_FOUND,
						message: "Authorized IP not found",
					},
				},
				404,
			);
		}

		// Update the IP
		const now = new Date().toISOString();
		await c.env.DB.prepare(
			"UPDATE user_authorized_ips SET name = ?, updated_at = ? WHERE id = ? AND user_id = ?",
		)
			.bind(name, now, id, user.id)
			.run();

		const updatedIP = await c.env.DB.prepare(
			"SELECT id, ip_address, name, last_used_at, created_at, updated_at FROM user_authorized_ips WHERE id = ?",
		)
			.bind(id)
			.first();

		return c.json({
			success: true,
			data: updatedIP,
		});
	} catch (error) {
		await logger.error(
			`Failed to update authorized IP ${id} for user ${user.id}: ${error instanceof Error ? error.message : String(error)}`,
		);

		return c.json(
			{
				success: false,
				error: {
					code: ApiErrorCode.INTERNAL_ERROR,
					message: "Failed to update authorized IP",
				},
			},
			500,
		);
	}
});

// Delete an authorized IP
app.delete("/:id", async (c) => {
	const user = c.get("user") as User;
	const { id } = c.req.param();

	try {
		const result = await c.env.DB.prepare(
			"DELETE FROM user_authorized_ips WHERE id = ? AND user_id = ?",
		)
			.bind(id, user.id)
			.run();

		if (!result.meta?.changes || result.meta.changes === 0) {
			return c.json(
				{
					success: false,
					error: {
						code: ApiErrorCode.RESOURCE_NOT_FOUND,
						message: "Authorized IP not found",
					},
				},
				404,
			);
		}

		return c.json({
			success: true,
			data: { message: "Authorized IP deleted successfully" },
		});
	} catch (error) {
		await logger.error(
			`Failed to delete authorized IP ${id} for user ${user.id}: ${error instanceof Error ? error.message : String(error)}`,
		);

		return c.json(
			{
				success: false,
				error: {
					code: ApiErrorCode.INTERNAL_ERROR,
					message: "Failed to delete authorized IP",
				},
			},
			500,
		);
	}
});

export default app;
