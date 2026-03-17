/**
 * Authentication middleware
 */
import type { Context, Next } from "hono";
import type { User } from "../types";
import type { AppEnv } from "../types/hono";
import { verifyToken } from "../utils/jwt-simple";
import { logger } from "../utils/logger";

/**
 * JWT Authentication middleware
 */
export const authMiddleware = async (c: Context<AppEnv>, next: Next) => {
	const authHeader = c.req.header("Authorization");

	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return c.json(
			{
				success: false,
				error: {
					code: "UNAUTHORIZED",
					message: "Missing or invalid authorization header",
				},
			},
			401,
		);
	}

	const token = authHeader.substring(7);

	try {
		// Verify JWT Token (stateless authentication)
		const payload = await verifyToken(token, c.env.JWT_SECRET!);

		// Get user information
		const user = (await c.env.DB.prepare("SELECT * FROM users WHERE id = ?")
			.bind(payload.sub)
			.first()) as User;

		if (!user) {
			return c.json(
				{
					success: false,
					error: { code: "USER_NOT_FOUND", message: "User not found" },
				},
				401,
			);
		}

		// Add user info to context (no session object needed for stateless auth)
		c.set("user", user);
		c.set("userId", user.id); // Set userId for easy access
		c.set("permissions", payload.permissions);
		c.set("plan_type", payload.plan_type);

		await next();
	} catch (_error) {
		return c.json(
			{
				success: false,
				error: { code: "INVALID_TOKEN", message: "Invalid token" },
			},
			401,
		);
	}
};

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
export const optionalAuthMiddleware = async (c: Context<AppEnv>, next: Next) => {
	const authHeader = c.req.header("Authorization");

	logger.info(
		`Optional auth middleware called for ${c.req.method} ${c.req.path} - ${authHeader ? "has auth header" : "no auth header"}`,
	);

	if (authHeader?.startsWith("Bearer ")) {
		const token = authHeader.substring(7);

		logger.info(`Processing JWT token (length: ${token.length})`);

		try {
			// Verify JWT Token (stateless authentication)
			const payload = await verifyToken(token, c.env.JWT_SECRET!);

			logger.info(
				`JWT token verified successfully for user ${payload.sub} with ${payload.permissions} permissions`,
			);

			// Get user information
			const user = (await c.env.DB.prepare("SELECT * FROM users WHERE id = ?")
				.bind(payload.sub)
				.first()) as User;

			logger.info(
				`Database user lookup for ${payload.sub}: ${user ? `found ${user.email}` : "not found"}`,
			);

			if (user) {
				// Add user info to context (no session object needed for stateless auth)
				c.set("user", user);
				c.set("userId", user.id); // Set userId for easy access
				c.set("permissions", payload.permissions);
				c.set("plan_type", payload.plan_type);

				logger.info(`User context set successfully for ${user.id} (${user.email})`);
			} else {
				await logger.error(`User not found in database: ${payload.sub}`);
			}
		} catch (error) {
			// Ignore errors in optional auth
			await logger.error(
				`Optional auth failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	} else {
		logger.info(
			`No valid authorization header found: ${authHeader ? "Present but invalid format" : "Missing"}`,
		);
	}

	await next();
};

/**
 * Permission check middleware
 */
export const requirePermission = (permission: string) => {
	return async (c: Context<AppEnv>, next: Next) => {
		const userPermissions = c.get("permissions") || [];

		if (!userPermissions.includes(permission)) {
			return c.json(
				{
					success: false,
					error: {
						code: "INSUFFICIENT_PERMISSIONS",
						message: `Permission required: ${permission}`,
					},
				},
				403,
			);
		}

		await next();
	};
};
